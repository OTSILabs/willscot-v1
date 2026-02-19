"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface FeedbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dialogMode: "correct" | "wrong" | null;
    dialogStep: "input" | "confirm";
    onFinalSave: (data: FeedbackFormValues | undefined) => void;
    onCancel: () => void;
}

const formSchema = z.object({
    feedback: z.string().trim().min(3, "Feedback must be at least 3 characters").max(500, "Feedback must be less than 500 characters"),
});

export type FeedbackFormValues = z.infer<typeof formSchema>;

export function FeedbackDialog({
    open,
    onOpenChange,
    dialogMode,
    dialogStep,
    onFinalSave,
    onCancel,
}: FeedbackDialogProps) {
    const form = useForm<FeedbackFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            feedback: "",
        },
    });

    return (
        <Dialog open={open} onOpenChange={(state) => {
            onOpenChange(state);
            form.reset();
        }}>
            <DialogContent>
                {dialogMode === "wrong" && dialogStep === "input" && (
                    <Form {...form}>
                        <DialogHeader>
                            <DialogTitle>Enter Expected Result</DialogTitle>
                        </DialogHeader>

                        <form onSubmit={form.handleSubmit(onFinalSave)} id="feedback-form">
                            <FormField
                                control={form.control}
                                name="feedback"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter your feedback here..."
                                                autoFocus
                                                rows={6}
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </form>


                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                form.reset();
                                onCancel();
                            }}>
                                Cancel
                            </Button>

                            <Button type="submit" form="feedback-form">
                                Confirm
                            </Button>
                        </DialogFooter>
                    </Form>
                )}

                {dialogStep === "confirm" && dialogMode === "correct" && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Are you sure?</DialogTitle>
                        </DialogHeader>

                        <p className="text-sm text-muted-foreground">
                            Once you confirm, this will be marked as{" "}
                            <span className="font-semibold text-foreground">
                                Correct
                            </span>{" "}
                            and cannot be changed again.
                        </p>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                form.reset();
                                onCancel();
                            }}>
                                Cancel
                            </Button>

                            <Button onClick={() => onFinalSave(form.getValues())}>Confirm</Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

