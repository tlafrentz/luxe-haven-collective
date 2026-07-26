export type PublishedArtifactEnvelope<TPayload>=Readonly<{artifactType:string;artifactVersion:string;rendererVersion:string;publishedAt:string;version:number;payload:TPayload}>;
export interface ArtifactRenderer<TPayload,TView>{readonly artifactType:string;readonly rendererVersion:string;render(artifact:PublishedArtifactEnvelope<TPayload>):TView}
