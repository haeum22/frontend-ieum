import { annotateOptionScores, evaluate } from "./qscc_calc.js";
import quizSchema from "./qscc.json" with { type: "json" };
import readline from 'readline';

// readline 인터페이스 생성
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// JSON 데이터의 scores 부분 자동 채우기
const completedSchema = annotateOptionScores(quizSchema);
const questions = completedSchema.questions;

// 사용자의 답변을 저장할 배열
const userAnswers = [];
let currentQuestionIndex = 0;

function askQuestion() {
    // 모든 질문을 마쳤을 때
    if (currentQuestionIndex >= questions.length) {
        rl.close();
        
        // 최종 체질 계산 및 출력
        const finalType = evaluate(completedSchema, userAnswers);
        console.log('\n---');
        console.log(`당신의 체질은 "${finalType}" 입니다.`);
        console.log('---');
        return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    console.log(`\n${currentQuestion.title} ${currentQuestion.text}`);

    currentQuestion.options.forEach(option => {
        console.log(`  ${option.id}. ${option.label}`);
    });

    rl.question('답변을 입력해주세요 (예: A): ', (answer) => {
        const validOptionIds = currentQuestion.options.map(o => o.id.toLowerCase());
        
        if (validOptionIds.includes(answer.toLowerCase())) {
            userAnswers.push({
                questionId: currentQuestion.id,
                optionId: answer.toUpperCase()
            });
            currentQuestionIndex++;
        } else {
            console.log('잘못된 답변입니다. 다시 입력해주세요.');
        }

        askQuestion();
    });
}

// 첫 질문 시작
askQuestion();