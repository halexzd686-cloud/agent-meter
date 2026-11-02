export async function pollDeepSeek({apiKey,budget=null,fetchImpl=fetch,signal}){
 if(!apiKey)return null;
 const response=await fetchImpl('https://api.deepseek.com/user/balance',{headers:{Authorization:'Bearer '+apiKey,Accept:'application/json'},signal:signal||AbortSignal.timeout(12000)});
 if(!response.ok){const error=new Error(response.status===401?'DeepSeek API Key 无效':response.status===429?'DeepSeek 请求过于频繁，稍后重试':'DeepSeek 余额查询失败（'+response.status+'）');error.status=response.status;throw error}
 const data=await response.json(),balance=data.balance_infos?.find(b=>b.currency==='CNY')||data.balance_infos?.find(b=>b.currency==='USD');
 if(!balance)throw new Error('DeepSeek 未返回支持的余额单位');
 const amount=Number(balance.total_balance);if(!Number.isFinite(amount)||amount<0)throw new Error('DeepSeek 返回了无效余额');
 return {provider:'deepseek',type:'quota.snapshot',observedAt:new Date().toISOString(),source:'deepseek-api',quota:{kind:'balance',amount,currency:balance.currency,budget:budget>0?budget:null}};
}
