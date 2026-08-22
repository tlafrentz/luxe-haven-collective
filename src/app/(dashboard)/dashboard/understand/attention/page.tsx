import { ExecutivePageView, type ExecutiveSearchParams } from "../executive-page";

export default function AttentionPage({searchParams}:Readonly<{searchParams:ExecutiveSearchParams}>){
  return <ExecutivePageView searchParams={searchParams} tab="risks"/>;
}
