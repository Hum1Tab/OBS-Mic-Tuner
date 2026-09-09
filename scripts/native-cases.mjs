import fs from 'node:fs';
import { compressor, expander, limiter } from '../app/dsp.mjs';
const dir = 'test-output/native'; fs.mkdirSync(dir,{recursive:true});
const pcm = Float32Array.from({ length:96000 }, (_,i) => {
  const t=i/48000, a = t<.2 ? 0 : t<.5 ? .8 : t<1 ? .005 : t<1.5 ? .2 : .03;
  return i===1000 ? .9 : a*Math.sin(t*2*Math.PI*180);
});
fs.writeFileSync(`${dir}/input.f32`,Buffer.from(pcm.buffer));
const comp={threshold:-24,ratio:3,attack:6,release:100,gain:8};
const exp={enabled:true,threshold:-35,ratio:2,attack:5,release:120};
const cases=[
  {name:'compressor',filters:[{id:'compressor_filter',settings:{threshold:comp.threshold,ratio:comp.ratio,attack_time:comp.attack,release_time:comp.release,output_gain:comp.gain}}], expected:compressor(pcm,48000,comp).pcm},
  {name:'expander',filters:[{id:'expander_filter',settings:{threshold:exp.threshold,ratio:exp.ratio,attack_time:exp.attack,release_time:exp.release,output_gain:0,detector:'RMS',presets:'expander'}}],expected:expander(pcm,48000,exp).pcm},
  {name:'limiter',filters:[{id:'limiter_filter',settings:{threshold:-3,release_time:60}}],expected:limiter(pcm,48000).pcm}
];
cases.push({name:'chain',filters:cases.flatMap(c=>c.filters),expected:limiter(expander(compressor(pcm,48000,comp).pcm,48000,exp).pcm,48000).pcm});
for(const c of cases) fs.writeFileSync(`${dir}/${c.name}-expected.f32`,Buffer.from(c.expected.buffer));
fs.writeFileSync(`${dir}/cases.json`,JSON.stringify(cases.map(({expected,...c})=>c),null,2));
