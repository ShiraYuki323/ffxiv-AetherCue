// Shared actions excluded by the combat-only catalog filter.
window.ACTIONS[3]={id:3,name:'冲刺',en:'Sprint',key:'SPRINT',icon:104,gcd:false,recast:60,level:1,job:'ALL',jobs:window.JOBS.map(j=>j.code)};
// Simulator-only action keys. These are deliberately not invented game action IDs.
window.ACTIONS.TINCTURE={id:'TINCTURE',name:'爆发药',en:'Tincture',key:'TINCTURE',icon:'tincture',gcd:false,job:'ALL',jobs:window.JOBS.map(j=>j.code),virtual:true,optional:true,note:'可选提示；暂不自动确认服药'};
