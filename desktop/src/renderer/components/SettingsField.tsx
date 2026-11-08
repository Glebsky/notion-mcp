import { useId, type InputHTMLAttributes } from "react";
import type { EnvConfig } from "../../types";
import { Input } from "../lib/shadcn/ui";
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "value" | "onChange"> {
  config: EnvConfig; onChange: (config: EnvConfig) => void; name: keyof EnvConfig; label: string; note?: string; wide?: boolean;
}
export function SettingsField({ config, onChange, name, label, note, wide, ...props }: Props) {
  const id = useId();
  return <div className={"settings-field" + (wide ? " settings-wide" : "")}>
    <label htmlFor={id}>{label}</label>
    <Input id={id} value={config[name]} onChange={event => onChange({ ...config, [name]: event.target.value })} aria-describedby={note ? id + "-note" : undefined} {...props}/>
    {note && <small id={id + "-note"}>{note}</small>}
  </div>;
}
