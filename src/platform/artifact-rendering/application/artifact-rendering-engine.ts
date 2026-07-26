import type {
  ArtifactRenderer,
  PublishedArtifactEnvelope,
} from "../domain/artifact-rendering";

export class ArtifactRenderingEngine {
  private readonly renderers = new Map<
    string,
    ArtifactRenderer<unknown, unknown>
  >();

  register<TPayload, TView>(renderer: ArtifactRenderer<TPayload, TView>) {
    if (this.renderers.has(renderer.artifactType)) {
      throw new Error("artifact_renderer_duplicate");
    }
    this.renderers.set(
      renderer.artifactType,
      renderer as ArtifactRenderer<unknown, unknown>,
    );
    return this;
  }

  render<TPayload, TView>(
    artifact: PublishedArtifactEnvelope<TPayload>,
  ): TView {
    const renderer = this.renderers.get(artifact.artifactType);
    if (!renderer) throw new Error("artifact_renderer_unavailable");
    if (renderer.rendererVersion !== artifact.rendererVersion) {
      throw new Error("artifact_renderer_version_mismatch");
    }
    return renderer.render(artifact) as TView;
  }
}
