// A retry uses the same request ID, so a lost acknowledgement cannot play twice.
export async function sendMove(url:string, body:Record<string,unknown>, fetcher:typeof fetch=fetch):Promise<Response> {
  const payload=JSON.stringify({...body,requestId:crypto.randomUUID()});
  for(let attempt=0;attempt<2;attempt++) {
    try {
      return await fetcher(url,{method:"POST",headers:{"Content-Type":"application/json"},
        signal:AbortSignal.timeout(15000),body:payload});
    } catch(error) {if(attempt===1)throw error;}
  }
  throw new Error("Could not reach the table.");
}
