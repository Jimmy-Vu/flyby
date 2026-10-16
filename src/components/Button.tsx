export function Button({ className = "", ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={`cursor-pointer rounded-md border border-line px-3 py-1.5 hover:not-disabled:border-accent hover:not-disabled:text-accent disabled:cursor-default disabled:opacity-40 ${className}`}
      {...props}
    />
  );
}
