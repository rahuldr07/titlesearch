import { Component, type ReactNode } from "react";

/**
 * A render-phase throw cannot be caught by try/catch: JSX is lazy, so
 * `<Card><Card/></Card>` only constructs elements inside the try block, and
 * React invokes the component later, when the caller's stack — and its
 * catch — is gone. A story proving a guard fires therefore needs an error
 * boundary, which in React 19 is still a class component; that is the only
 * reason a class exists in this kit. A test affordance, not an app-level
 * boundary — it renders the message so a story can assert on it, no more.
 */
export class RenderBoundary extends Component<
  { readonly children: ReactNode },
  { readonly message: string | null }
> {
  override state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : "threw" };
  }

  override render() {
    if (this.state.message !== null) {
      return (
        <p className="font-sans text-meta leading-body text-state-halt">
          {this.state.message}
        </p>
      );
    }
    return this.props.children;
  }
}
