import test from 'node:test';
import assert from 'node:assert/strict';
import {quotaLabel,metric,ratio} from '../renderer/format.mjs';
test('quota display labels real windows and preserves unknown denominator',()=>{
 assert.equal(quotaLabel({quota:{kind:'window',windowMinutes:300}}),'5 小时额度剩余');
 assert.equal(quotaLabel({quota:{kind:'window',windowMinutes:10080}}),'7 天额度剩余');
 assert.equal(metric({quota:{kind:'balance',amount:0,currency:'CNY'}}),'¥0.00');
 assert.equal(ratio({quota:{kind:'balance',amount:26.8,currency:'CNY'}}),null);
});
