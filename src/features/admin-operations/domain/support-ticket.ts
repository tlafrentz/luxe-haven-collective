export type TicketStatus="open"|"in_progress"|"waiting_on_customer"|"resolved"|"closed";
export type TicketPriority="low"|"medium"|"high"|"urgent";
const transitions:Readonly<Record<TicketStatus,readonly TicketStatus[]>>={open:["in_progress","waiting_on_customer","resolved","closed"],in_progress:["waiting_on_customer","resolved","closed"],waiting_on_customer:["in_progress","resolved","closed"],resolved:["open","in_progress","closed"],closed:["open"]};
export function assertTicketTransition(from:TicketStatus,to:TicketStatus){if(from===to)return;if(!transitions[from].includes(to))throw new Error(`Unsupported ticket transition: ${from} to ${to}.`);}
