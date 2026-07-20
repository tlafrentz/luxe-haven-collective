export interface Executor<TInput,TSession> {
  execute(input:TInput): Promise<TSession>;
}
