import type { AcquisitionTransactionalContext, AcquisitionUnitOfWork } from "../../../application/ports";
import { AcquisitionTransactionError } from "./acquisition-transaction-error";
export class SupabaseAcquisitionUnitOfWork implements AcquisitionUnitOfWork { public constructor(private readonly context: AcquisitionTransactionalContext) {} public async execute<T>(operation: (context: AcquisitionTransactionalContext) => Promise<T>): Promise<T> { try { return await operation(this.context); } catch (error) { if (error instanceof AcquisitionTransactionError) throw error; throw error; } } }
