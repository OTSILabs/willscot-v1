"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
}

interface MultiSelectUserFilterProps {
  users: User[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function MultiSelectUserFilter({ 
  users, 
  selectedIds, 
  onSelectionChange 
}: MultiSelectUserFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleUser = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const selectedNames = users
    .filter(u => selectedIds.includes(u.id))
    .map(u => u.name);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-transparent border-0 h-9 md:h-8 text-xs w-full md:w-[160px] shadow-none focus:ring-0 justify-between font-medium group"
      >
        <span className="truncate pr-2 uppercase tracking-tight">
          {selectedIds.length === 0 ? "All Users" : 
           selectedIds.length === 1 ? selectedNames[0] : 
           `${selectedIds.length} Selected`}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 opacity-50 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute left-0 top-full mt-1 w-[220px] bg-white border rounded-lg shadow-xl z-50 p-1 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
            <div className="flex flex-col max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
              <button
                type="button"
                onClick={() => {
                  onSelectionChange([]);
                  setIsOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 rounded-md transition-colors text-left w-full"
              >
                <div className={cn(
                  "w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors",
                  selectedIds.length === 0 ? "bg-primary border-primary" : "border-input"
                )}>
                  {selectedIds.length === 0 && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={cn(selectedIds.length === 0 && "font-semibold")}>All Users</span>
              </button>
              
              <div className="h-px bg-muted my-1" />

              {users.map((user) => {
                const isSelected = selectedIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleUser(user.id)}
                    className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 rounded-md transition-colors text-left w-full"
                  >
                    <div className={cn(
                      "w-3.5 h-3.5 border rounded flex items-center justify-center transition-colors",
                      isSelected ? "bg-primary border-primary" : "border-input"
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className={cn(isSelected && "font-semibold")}>{user.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
