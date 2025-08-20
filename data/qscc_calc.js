/**** QSCC-II 채점 + 판별 (scores 자동 주입 & 최종 체질 계산) ****/

// 1) 문항→하위척도 매핑 (Table 8 요지)
const SCALES = {
  태양1: new Set(["2b","2c","5c","6b","8b","12d","17","18","19","21","22","25","31","32","34","48","59","61","69","79","97","102","103","106","108","111"]),
  태양2: new Set(["1b","4d","9c","10a","12b","14b","15a","52"]), // 2점
  소양1: new Set(["1c","2b","2c","3a","5c","6c","7c","9c","10a","12b","14b","15a","17","19","20","25","31","35","39","48","55","61","63","69","75","85","86","88","98"]),
  소양2: new Set(["1b","16","18","34"]), // 2점
  태음1: new Set(["1a","2a","3a","5a","6a","7c","8b","9a","10a","12b","12d","14b","15a","16","18","19","21","30","33","35","39","50","51","61","70","73","88","110"]),
  태음2: new Set([]),
  소음1: new Set(["1c","4d","6b","9b","15c","30","33","50","51","64","65","67","73","86","89","95"]),
  소음2: new Set(["2c","5b","10b","12d","23","52","88"]) // 2점
};

// 2) 가중치 규칙 (요청대로: 태양2/소양2/소음2만 2점)
const WEIGHT = { 태양1:1, 태양2:2, 소양1:1, 소양2:2, 태음1:1, 태음2:1, 소음1:1, 소음2:2 };

// 3) 판별식 계수 (Table 10)
const DISCRIM = {
  태양: { coef:{태양:0.828,  소양:-0.07021, 태음:0.533,  소음:0.373}, const:-13.638 },
  소양: { coef:{태양:0.352,  소양:0.410,    태음:0.500,  소음:0.449}, const:-11.809 },
  태음: { coef:{태양:0.361,  소양:0.03093,  태음:1.113,  소음:0.349}, const:-12.427 },
  소음: { coef:{태양:0.339,  소양:0.164,    태음:0.644,  소음:0.649}, const:-12.379 }
};

// 보조: 질문id+옵션id -> "3a" 같은 문항코드로
function toItemCode(questionId, optionId) {
  const num = String(questionId).replace(/\D/g, "");
  return `${num}${String(optionId).toLowerCase()}`;
}

// (A) schema.questions[*].options[*].scores 채우기
// scores는 요청하신 대로 {태양인, 소양인, 소음인, 태음인} 순서/이름으로 기록
export function annotateOptionScores(schema) {
  for (const q of schema.questions ?? []) {
    for (const opt of q.options ?? []) {
      const empty = !opt.scores || Object.keys(opt.scores).length === 0;
      if (!empty) continue;

      const code = toItemCode(q.id, opt.id);
      // 하위척도 적중 확인
      const sub = {태양1:0,태양2:0,소양1:0,소양2:0,태음1:0,태음2:0,소음1:0,소음2:0};
      for (const s in SCALES) if (SCALES[s].has(code)) sub[s] += WEIGHT[s];
      // 상위 4척도로 합산
      const top = {
        태양: sub.태양1 + sub.태양2,
        소양: sub.소양1 + sub.소양2,
        태음: sub.태음1 + sub.태음2,
        소음: sub.소음1 + sub.소음2
      };
      // 옵션에 주입 (표시 라벨은 …인)
      opt.scores = {
        "태양인": top.태양,
        "소양인": top.소양,
        "소음인": top.소음,
        "태음인": top.태음
      };
    }
  }
  return schema;
}

// (B) 응답으로 점수 합산 → 판별식 계산 → 최종 체질
// answers: [{questionId:1, optionId:"A"}, ...]
export function evaluate(schema, answers) {
  // 응답 코드 집합 만들기
  const codes = new Set(answers.map(a => toItemCode(a.questionId ?? a.id, a.optionId ?? a.option)));
  // 8개 하위척도
  const sub8 = {태양1:0,태양2:0,소양1:0,소양2:0,태음1:0,태음2:0,소음1:0,소음2:0};
  for (const code of codes) {
    for (const s in SCALES) if (SCALES[s].has(code)) sub8[s] += WEIGHT[s];
  }
  // 4개 상위척도
  const top4 = {
    태양: sub8.태양1 + sub8.태양2,
    소양: sub8.소양1 + sub8.소양2,
    태음: sub8.태음1 + sub8.태음2,
    소음: sub8.소음1 + sub8.소음2
  };
  // 판별식 값
  const d = {};
  for (const k in DISCRIM) {
    const {coef, const: c} = DISCRIM[k];
    d[k] = coef.태양*top4.태양 + coef.소양*top4.소양 + coef.태음*top4.태음 + coef.소음*top4.소음 + c;
  }
  // 최종 체질 (동률 시 schema.scoring.tieBreaker 사용)
  const mapK2Label = {태양:"태양인", 소양:"소양인", 태음:"태음인", 소음:"소음인"};
  const entries = Object.entries(d).sort((a,b)=>b[1]-a[1]);
  const maxVal = entries[0][1];
  const tiedKeys = entries.filter(([_,v])=>v===maxVal).map(([k])=>k);
  let finalKey = tiedKeys[0];
  if (tiedKeys.length > 1) {
    const pref = schema?.scoring?.tieBreaker ?? ["태양인","태음인","소양인","소음인"];
    const label2Key = {"태양인":"태양","태음인":"태음","소양인":"소양","소음인":"소음"};
    for (const lab of pref) {
      const k = label2Key[lab];
      if (tiedKeys.includes(k)) { finalKey = k; break; }
    }
  }
  return mapK2Label[finalKey];
}