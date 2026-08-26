"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-start gap-2 px-2 font-normal"
        >
          <span
            className="size-5 shrink-0 rounded-md border border-foreground/10"
            style={{ background: value }}
          />
          <span className="text-xs text-muted-foreground">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit gap-3 p-3" align="start">
        <HexColorPicker color={value} onChange={onChange} />
        <div className="flex items-center gap-2">
          <span className="size-5 shrink-0 rounded-md border border-foreground/10" style={{ background: value }} />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-full font-mono text-xs"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
