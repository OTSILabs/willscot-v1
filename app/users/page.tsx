"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle, PageDescription } from "@/components/typography";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ButtonGroup } from "@/components/ui/button-group";
import { PaginationControls } from "@/components/ui/table";

type UserRole = "power_user" | "normal_user";

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface UsersApiResponse {
  items: User[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface UserPayload {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

const DEFAULT_FORM: UserPayload = {
  name: "",
  email: "",
  role: "normal_user",
  password: "",
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState<UserPayload>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserPayload>(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState("");

  const usersQuery = useQuery({
    queryKey: ["users", page, pageSize, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const response = await fetch(`/api/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return (await response.json()) as UsersApiResponse;
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: UserPayload) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, role: "normal_user" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }
    },
    onSuccess: async () => {
      setPage(1);
      setCreateForm(DEFAULT_FORM);
      setIsCreateOpen(false);
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create user");
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<UserPayload>;
    }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update user");
      }
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditForm(DEFAULT_FORM);
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update user");
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete user");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete user");
    },
  });

  const isSaving = useMemo(
    () =>
      createUser.isPending || updateUser.isPending || deleteUser.isPending,
    [createUser.isPending, deleteUser.isPending, updateUser.isPending],
  );

  function startEdit(user: User) {
    setErrorMessage("");
    setEditingId(user.id);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
    });
  }

  return (
    <div className="container mx-auto px-4 md:px-0 py-4 md:py-10 space-y-4 md:space-y-6 pb-16 md:pb-10">
      <div className="flex flex-col space-y-4">
        {/* Universal Back Button */}
        <div className="flex items-center gap-2">
          <BackButton label="Back to Traces" />
        </div>

        {/* Unified Header Layout matching Traces */}
        <div className="flex items-start justify-between gap-3 border-b pb-3 md:border-none md:pb-0">
          <div className="max-w-[calc(100%-100px)] md:max-w-none space-y-1">
            <PageTitle title="Users" />
            <PageDescription description="Add, edit and delete application users." />
          </div>
          <Button
            onClick={() => {
              setErrorMessage("");
              setIsCreateOpen(true);
            }}
            className="shrink-0"
          >
            New User
          </Button>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              New users are created with role: normal user.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Name"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <Input
              type="email"
              placeholder="Email"
              value={createForm.email}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, email: event.target.value }))
              }
            />
            <Input
              type="password"
              placeholder="Password"
              value={createForm.password}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, password: event.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={createUser.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isSaving ||
                !createForm.name.trim() ||
                !createForm.email.trim() ||
                !createForm.password.trim()
              }
              onClick={() => createUser.mutate(createForm)}
            >
              {createUser.isPending ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      <div className="rounded-md md:border border-none">
        <div className="border-b px-0 py-3">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="max-w-xs md:max-w-sm"
          />
        </div>
        <div className="hidden md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[15%]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : usersQuery.data?.items?.length ? (
              usersQuery.data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {editingId === user.id ? (
                      <Input
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      user.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === user.id ? (
                      <Input
                        value={editForm.email}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      user.email
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === user.id ? (
                      <Select
                        value={editForm.role}
                        onValueChange={(value: UserRole) =>
                          setEditForm((prev) => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="power_user">Power user</SelectItem>
                          <SelectItem value="normal_user">Normal user</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : user.role === "power_user" ? (
                      "Power user"
                    ) : (
                      "Normal user"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {editingId === user.id ? (
                      <ButtonGroup>
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() =>
                            updateUser.mutate({
                              id: user.id,
                              payload: {
                                name: editForm.name,
                                email: editForm.email,
                                role: editForm.role,
                                password: editForm.password,
                              },
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSaving}
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(DEFAULT_FORM);
                          }}
                        >
                          Cancel
                        </Button>
                      </ButtonGroup>
                    ) : (
                      <ButtonGroup>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </Button>
                        {user.role !== "power_user" ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deleteUser.isPending}
                            onClick={() => deleteUser.mutate(user.id)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </ButtonGroup>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden flex flex-col gap-4 pt-2">
          {usersQuery.isLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Loading users...
            </div>
          ) : usersQuery.data?.items?.length ? (
            usersQuery.data.items.map((user) => (
              <div key={user.id} className="rounded-xl p-3 bg-card shadow-sm flex flex-col gap-3 border md:border-none text-card-foreground">
                {editingId === user.id ? (
                  <div className="flex flex-col gap-3">
                    <Input
                      placeholder="Name"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="h-9"
                    />
                    <Input
                      placeholder="Email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      className="h-9"
                    />
                    <Select
                      value={editForm.role}
                      onValueChange={(value: UserRole) => setEditForm(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="power_user">Power user</SelectItem>
                        <SelectItem value="normal_user">Normal user</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Input
                      type="password"
                      placeholder="New password (optional)"
                      value={editForm.password}
                      onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                      className="h-9"
                    />

                    <div className="flex gap-2 pt-2 border-t mt-1">
                      <Button
                        className="flex-1"
                        size="sm"
                        disabled={isSaving}
                        onClick={() =>
                          updateUser.mutate({
                            id: user.id,
                            payload: {
                              name: editForm.name,
                              email: editForm.email,
                              role: editForm.role,
                              password: editForm.password,
                            },
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        className="flex-1"
                        size="sm"
                        variant="outline"
                        disabled={isSaving}
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(DEFAULT_FORM);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex flex-col break-words max-w-[70%]">
                        <span className="font-normal">{user.name}</span>
                        <span className="text-sm text-muted-foreground break-all">{user.email}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-accent text-[10px] font-normal shrink-0 uppercase tracking-wider">
                        {user.role === "power_user" ? "Power User" : "Normal User"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between border-t pt-3 mt-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        Joined {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 shadow-sm"
                          onClick={() => startEdit(user)}
                        >
                          Edit
                        </Button>
                        {user.role !== "power_user" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs px-2.5 shadow-sm"
                            disabled={deleteUser.isPending}
                            onClick={() => deleteUser.mutate(user.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No users found.
            </div>
          )}
        </div>
        <PaginationControls
          currentPage={usersQuery.data?.pagination.page ?? 1}
          totalPages={usersQuery.data?.pagination.totalPages ?? 1}
          totalItems={usersQuery.data?.pagination.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>



      {editingId ? (
        <div className="rounded-md border p-4 space-y-2">
          <p className="text-sm font-medium">Optional: Reset password while editing</p>
          <Input
            type="password"
            placeholder="New password (leave empty to keep current)"
            value={editForm.password}
            onChange={(event) =>
              setEditForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
        </div>
      ) : null}
    </div>
  );
}

