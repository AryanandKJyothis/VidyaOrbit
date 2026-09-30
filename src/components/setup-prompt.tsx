import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useInstitute, useUpdateInstitute } from "@/hooks/use-data";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";

export function SetupPrompt() {
  const inst = useInstitute();
  const mut = useUpdateInstitute();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (inst.data && inst.data.name === "My Institute") {
      setOpen(true);
    }
  }, [inst.data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Please enter your institute name");
    try {
      await mut.mutateAsync({ name: trimmed });
      toast.success("Institute name saved!");
      setOpen(false);
    } catch (e) {
      toast.error(formatUserError(e, "Could not save institute name."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Vidya!</DialogTitle>
          <DialogDescription>
            Let's set up your institute. What's the name of your coaching centre
            or institution?
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inst-name">Institute name</Label>
            <Input
              id="inst-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bright Future Academy"
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Later
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
