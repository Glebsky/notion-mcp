// shadcn/ui primitives, adapted to the application's Liquid Glass surface.
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type InputHTMLAttributes, type ButtonHTMLAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "./utils";

const buttonVariants = cva("glass-button", {
  variants: { variant: { default: "glass-button-primary", outline: "glass-button-outline", ghost: "glass-button-ghost" }, size: { default: "", sm: "glass-button-sm", icon: "glass-button-icon" } },
  defaultVariants: { variant: "outline", size: "default" },
});
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props}/>;
});
Button.displayName = "Button";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn("glass-input", className)} {...props}/>);
Input.displayName = "Input";
export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root ref={ref} className={cn("glass-switch", className)} {...props}><SwitchPrimitive.Thumb className="glass-switch-thumb"/></SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

export const Dialog = DialogPrimitive.Root;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, ComponentPropsWithoutRef<typeof DialogPrimitive.Content>>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="glass-dialog-overlay"/>
    <DialogPrimitive.Content ref={ref} className={cn("glass-dialog", className)} {...props}>
      {children}
      <DialogPrimitive.Close className="glass-button glass-button-ghost glass-button-icon glass-dialog-close" aria-label="Close settings"><X size={17}/></DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} className={cn("glass-select-trigger", className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDown size={15}/></SelectPrimitive.Icon></SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";
export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content ref={ref} position={position} sideOffset={6} className={cn("glass-select-content", className)} {...props}>
      <SelectPrimitive.ScrollUpButton className="flex justify-center py-1"><ChevronUp size={15}/></SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex justify-center py-1"><ChevronDown size={15}/></SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";
export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn("glass-select-item", className)} {...props}>
    <span className="absolute left-2 flex items-center"><SelectPrimitive.ItemIndicator><Check size={14}/></SelectPrimitive.ItemIndicator></span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";
