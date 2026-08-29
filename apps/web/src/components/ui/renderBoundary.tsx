import { Component, type ReactNode } from "react";

/**
 * A RENDER-PHASE THROW IS CATCHABLE BY EXACTLY ONE MECHANISM, AND try/catch IS
 * NOT IT.
 *
 * Written for `card.stories.tsx`, whose "nested cards throw" story first used
 * `try { return <Card><Card/></Card> } catch`. That story FAILED with the raw
 * throw rather than the assertion, and the reason is worth keeping: JSX is
 * lazy. `<Card><Card/></Card>` only CONSTRUCTS elements inside the try block;
 * React invokes the component later, during its own render pass, by which point
 * the caller's stack — and its catch — is long gone.
 *
 * So a story that wants to PROVE a guard fires needs an error boundary, and an
 * error boundary in React 19 is still a class component. That is the only
 * reason a class exists in this kit.
 *
 * This is a TEST AFFORDANCE, not an app one. An app-level boundary is a
 * different object with different obligations (reporting, a recovery path, a
 * sentence for the user); this one renders the message so a story can assert
 * on it, and nothing more.
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
