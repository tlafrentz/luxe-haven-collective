import type {
  AcquisitionWorkspaceAuthorizationSource,
  AcquisitionWorkspaceAuthorizer,
} from "../application";

export type AcquisitionWorkspacePrincipal = Readonly<{
  authenticated: boolean;
  actorId?: string;
  ownerId?: string;
  capabilities: Readonly<{
    activate: boolean;
    manageOffers: boolean;
    recordContract: boolean;
    manageRequirements: boolean;
    prepareClosing: boolean;
    close: boolean;
    exit: boolean;
  }>;
}>;

export interface AcquisitionWorkspacePrincipalReader {
  getPrincipal(): Promise<AcquisitionWorkspacePrincipal>;
}

export class ProductionAcquisitionWorkspaceAuthorizer implements AcquisitionWorkspaceAuthorizer {
  public constructor(private readonly principals: AcquisitionWorkspacePrincipalReader) {}

  public async authorize(input: Parameters<AcquisitionWorkspaceAuthorizer["authorize"]>[0]): Promise<AcquisitionWorkspaceAuthorizationSource> {
    const principal = await this.principals.getPrincipal();
    const actorMatches = principal.actorId === input.actor.id;
    const ownerMatches = principal.ownerId === input.ownerId;
    const canRead = principal.authenticated && actorMatches && ownerMatches;
    return Object.freeze({
      authenticated: principal.authenticated,
      canRead,
      capabilities: Object.freeze({
        activate: canRead && principal.capabilities.activate,
        manageOffers: canRead && principal.capabilities.manageOffers,
        recordContract: canRead && principal.capabilities.recordContract,
        manageRequirements: canRead && principal.capabilities.manageRequirements,
        prepareClosing: canRead && principal.capabilities.prepareClosing,
        close: canRead && principal.capabilities.close,
        exit: canRead && principal.capabilities.exit,
      }),
    });
  }
}
