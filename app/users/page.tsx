"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { humanizeDateTime } from "@/lib/utils";
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
import { toast } from "sonner";
import { useCurrentUser } from "@/components/current-user-provider";
import { useRouter, useSearchParams } from "next/navigation";
import { TruncatedCell } from "@/components/common/truncated-cell";
import { useEffect } from "react";

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

// API Fetch Helpers extracted to reduce component bloat
async function fetchUsersApi(page: number, pageSize: number, search: string): Promise<UsersApiResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search.trim()) params.set("search", search.trim());
  const response = await fetch(`/api/users?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

async function createUserApi(payload: UserPayload) {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Failed to create user");
  return data;
}

async function updateUserApi({ id, payload }: { id: string; payload: Partial<UserPayload> }) {
  const response = await fetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Failed to update user");
  return data;
}

async function deleteUserApi(id: string) {
  const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(data.error || "Failed to delete user");
  return data;
}

export default function UsersPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (currentUser && currentUser.role !== "power_user") {
      router.push("/traces");
    }
  }, [currentUser, router]);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState<UserPayload>(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserPayload>(DEFAULT_FORM);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Confirmation state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [isRoleConfirmOpen, setIsRoleConfirmOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; payload: Partial<UserPayload>; name: string; oldRole: string; newRole: string } | null>(null);

  const { data: usersData, isLoading: isUsersLoading, isFetching: isUsersFetching } = useQuery({
    queryKey: ["users", currentUser?.id, page, pageSize, search],
    queryFn: () => fetchUsersApi(page, pageSize, search),
    enabled: !!currentUser && currentUser.role === "power_user",
    placeholderData: keepPreviousData,
  });

  const createUser = useMutation({
    mutationFn: createUserApi,
    onSuccess: async () => {
      setPage(1);
      setCreateForm(DEFAULT_FORM);
      setIsCreateOpen(false);
      setErrorMessage("");
      toast.success("User created successfully");
      await queryClient.invalidateQueries({ queryKey: ["users", currentUser?.id] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to create user";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const updateUser = useMutation({
    mutationFn: updateUserApi,
    onSuccess: async () => {
      setEditingId(null);
      setEditForm(DEFAULT_FORM);
      setErrorMessage("");
      toast.success("User updated successfully");
      await queryClient.invalidateQueries({ queryKey: ["users", currentUser?.id] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to update user";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const deleteUser = useMutation({
    mutationFn: deleteUserApi,
    onSuccess: async () => {
      toast.success("User deleted successfully");
      await queryClient.invalidateQueries({ queryKey: ["users", currentUser?.id] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "Failed to delete user";
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const isSaving = useMemo(
    () =>
      createUser.isPending || updateUser.isPending || deleteUser.isPending,
    [createUser.isPending, deleteUser.isPending, updateUser.isPending],
  );

  if (!currentUser || currentUser.role !== "power_user") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

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
    <div className="container mx-auto px-4 xl:px-0 py-4 xl:py-10 space-y-4 xl:space-y-6 pb-16 xl:pb-10">
      <div className="flex flex-col space-y-4">
        {/* Universal Back Button */}
        <div className="flex items-center gap-2">
          <BackButton label="Back to Traces" />
        </div>

        {/* Unified Header Layout matching Traces */}
        <div className="flex items-start justify-between gap-3 border-b pb-3 xl:border-none xl:pb-0">
          <div className="max-w-[calc(100%-100px)] xl:max-w-none space-y-1">
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
              Enter details to create a new application user.
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
            <Select
              value={createForm.role}
              onValueChange={(value: UserRole) =>
                setCreateForm((prev) => ({ ...prev, role: value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="power_user">Power user</SelectItem>
                <SelectItem value="normal_user">Normal user</SelectItem>
              </SelectContent>
            </Select>
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

      <div className="rounded-md xl:border border-none">
        <div className="border-b px-0 py-3 flex items-center">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="max-w-xs xl:max-w-sm"
          />
          {isUsersFetching && (
            <div className="flex items-center gap-2 ml-4 text-[10px] font-medium text-muted-foreground animate-pulse">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              Refreshing...
            </div>
          )}
        </div>
        <div className="hidden xl:block">
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
            {isUsersLoading && !usersData ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : usersData?.items?.length ? (
              usersData.items.map((user) => (
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
                      <TruncatedCell content={user.email} />
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
                    {humanizeDateTime(user.createdAt, "dd MMM yy")}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {editingId === user.id ? (
                      <ButtonGroup>
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => {
                            const payload = {
                              name: editForm.name,
                              email: editForm.email,
                              role: editForm.role,
                              password: editForm.password,
                            };
                            
                            if (editForm.role !== user.role) {
                              setPendingUpdate({
                                id: user.id,
                                payload,
                                name: user.name,
                                oldRole: user.role,
                                newRole: editForm.role,
                              });
                              setIsRoleConfirmOpen(true);
                            } else {
                              updateUser.mutate({ id: user.id, payload });
                            }
                          }}
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
                            onClick={() => {
                              setUserToDelete(user);
                              setIsDeleteConfirmOpen(true);
                            }}
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
        <div className="xl:hidden flex flex-col gap-4 pt-2">
          {isUsersLoading && !usersData ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading users...</p>
            </div>
          ) : usersData?.items?.length ? (
            usersData.items.map((user) => (
              <div key={user.id} className="rounded-xl p-3 bg-card shadow-sm flex flex-col gap-3 border xl:border-none text-card-foreground">
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
                        onClick={() => {
                          const payload = {
                            name: editForm.name,
                            email: editForm.email,
                            role: editForm.role,
                            password: editForm.password,
                          };
                          
                          if (editForm.role !== user.role) {
                            setPendingUpdate({
                              id: user.id,
                              payload,
                              name: user.name,
                              oldRole: user.role,
                              newRole: editForm.role,
                            });
                            setIsRoleConfirmOpen(true);
                          } else {
                            updateUser.mutate({ id: user.id, payload });
                          }
                        }}
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
                        <span className="text-sm text-muted-foreground truncate" title={user.email}>{user.email}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-accent text-[10px] font-normal shrink-0 uppercase tracking-wider">
                        {user.role === "power_user" ? "Power User" : "Normal User"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between border-t pt-3 mt-1">
                      <div className="flex flex-col">
                        <span className="text-xs uppercase text-muted-foreground font-normal mb-1">Created At</span>
                        <span className="text-sm font-normal text-foreground">
                          {humanizeDateTime(user.createdAt, "dd MMM yy")}
                        </span>
                      </div>
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
                            onClick={() => {
                              setUserToDelete(user);
                              setIsDeleteConfirmOpen(true);
                            }}
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
          currentPage={usersData?.pagination.page ?? 1}
          totalPages={usersData?.pagination.totalPages ?? 1}
          totalItems={usersData?.pagination.total ?? 0}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>
      {editingId ? (
        <div className="rounded-md border p-4 mt-6 space-y-2 max-w-md">
          <p className="text-sm font-medium">Optional: Reset password while editing</p>
          <Input
            type="password"
            placeholder="New password (leave empty to keep current)"
            value={editForm.password}
            onChange={(event) =>
              setEditForm((prev) => ({ ...prev, password: event.target.value }))
            }
            className="h-9"
          />
        </div>
      ) : null}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive font-bold text-xl flex items-center gap-2">
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-base py-2">
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action will permanently remove the user and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              onClick={() => {
                if (userToDelete) {
                  deleteUser.mutate(userToDelete.id);
                  setIsDeleteConfirmOpen(false);
                }
              }}
            >
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Dialog */}
      <Dialog open={isRoleConfirmOpen} onOpenChange={setIsRoleConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold text-xl">Confirm Role Change</DialogTitle>
            <DialogDescription className="text-base py-2">
              Are you sure you want to change <strong>{pendingUpdate?.name}</strong>&apos;s role from{" "}
              <span className="font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-sm">{pendingUpdate?.oldRole?.replace("_", " ")}</span> to{" "}
              <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary text-sm">{pendingUpdate?.newRole?.replace("_", " ")}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsRoleConfirmOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                if (pendingUpdate) {
                  updateUser.mutate({
                    id: pendingUpdate.id,
                    payload: pendingUpdate.payload,
                  });
                  setIsRoleConfirmOpen(false);
                }
              }}
            >
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

