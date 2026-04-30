#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  'https://rvkpwclnmwzsulomoppq.supabase.co',
  'sb_publishable_KOTn-tsQ5j0g0ZUbpJXNzw_8jTLmSpB'
)

const updates = [
  { item_name: '공사신고/입주민 동의서', comment: '아파트 내규에 따라 변동가능' },
  { item_name: '행위허가 대행료', comment: '구조변경시 진행필요' },
  { item_name: '승강기 사용료', comment: '아파트 내규에 따라 변동가능' },
  { item_name: '승강기 보양료', comment: '아파트 내규에 따라 변동가능' },
  { item_name: '동선 보양료', comment: '아파트 내규에 따라 변동가능' },
  { item_name: '공정중 현장 보양 및 시공', comment: '플로베니아, 종이보양지, 종이각대 등' },
  { item_name: '가설전기', comment: '작업등작업' },
  { item_name: '주차요금', comment: '아파트 내규에 따라 변동가능' },
  { item_name: '공정 중 폐기물처리', comment: '1톤 1차 폐기물 처리 비용' },
  { item_name: '스프링쿨러 이설', comment: '구조변경시 추가가능' },
  { item_name: '인터폰 교체', comment: '교체 모델에 따라 변동가능' },
  { item_name: '보일러컨트롤러 교체', comment: '교체 모델에 따라 변동가능' },
  { item_name: '도어락 교체', comment: '교체 모델에 따라 변동가능' },
  { item_name: '샤시 외부 코킹작업', comment: '누수여부에 따라 진행가능' },
  { item_name: '샤시 손잡이 교체', comment: '노후 여부에 따라 추가가능' },
  { item_name: '방충망 교체', comment: '노후 여부에 따라 추가가능' },
  { item_name: '입주청소', comment: '*고객님 섭외*' },
  { item_name: '장비대', comment: '사다리차, 또는 스카이 필요 한 경우' },
  { item_name: '인건비 / 폐기물 처리비용', comment: '바닥 마루 종류에 따라 추가가능( ex : 철거가 어려운 합판 마루)' },
  { item_name: '욕실 방수설비', comment: '1차 액상방수\n2차, 3차 아쿠아디펜스 방수 작업' },
  { item_name: '소방설비', comment: '전체 소방감지기 교체\n(감지기 종류에 따라 비용변동가능)' },
  { item_name: '수도/배관 이설 작업', comment: '길이에 따라 책정' },
  { item_name: '콘센트 신설(까대기 작업)', comment: '5개까지 추가비용 없음.' },
  { item_name: '분전함 교체', comment: '스피커, 누전차단기, 감지기, 분전함 교체' },
  { item_name: '창호교체비용', comment: '이건창호 기준\n실제 현장 실측 후 비용 변동 있고, 현재 견적은 대략적인 예상 비용입니다.' },
  { item_name: '가벽생성', comment: '설계에 따라 목공사 비용은 변동될 수 있습니다.' },
  { item_name: '인건비', comment: '6명 * 10일 작업기준' },
  { item_name: '일반 여닫이 문', comment: 'ABS도어 + 경첩 + 손잡이 포함' },
  { item_name: '슬라이딩 문', comment: 'ABS도어 + 슬라이딩레일 + 손잡이 포함' },
  { item_name: '현관바닥타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '주방 벽타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '거실욕실 타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '거실욕실 타일(자녀방)', comment: '지정타일 기준(로스포함)' },
  { item_name: '안방욕실 타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '베란다 타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '거실,주방 바닥타일', comment: '지정타일 기준(로스포함)' },
  { item_name: '막타일', comment: '모자이크 타일 시공시 필요한 경우' },
  { item_name: '트렌치 유가', comment: '제작' },
  { item_name: '타일유가', comment: '타일마감 고급유가' },
  { item_name: '일반 배수유가', comment: '세탁배수유가, 일반형' },
  { item_name: '시공비( 600*600)', comment: '타일시공' },
  { item_name: '시공비(모자이크타일)', comment: '타일시공' },
  { item_name: '시공비(600*600 이상, 박판타일)', comment: '타일시공' },
  { item_name: '양중', comment: '타일양중' },
  { item_name: '케라폭시 시공', comment: '옵션 선택사항( 인건비가 많이 드는 고가의 줄눈시공으로 유지관리, 오염에 강합니다.)' },
  { item_name: '공용부 벽면 도장', comment: '벤자민 scuff-x' },
  { item_name: '발코니 도장', comment: '세라믹코트 or 수성도장' },
  { item_name: '필름 래핑', comment: '전체 샤시 래핑' },
  { item_name: '전체 실크벽지', comment: '디아망 벽지' },
  { item_name: '세면수전', comment: '수전 종류에 따라 비용변동' },
  { item_name: ' 매립세면수전', comment: '수전 종류에 따라 비용변동' },
  { item_name: '샤워수전', comment: '수전 종류에 따라 비용변동' },
  { item_name: ' 매립샤워수전', comment: '수전 종류에 따라 비용변동' },
  { item_name: ' 슬라이드 바', comment: '수전 종류에 따라 비용변동' },
  { item_name: '수납장', comment: '제작' },
  { item_name: '욕실 악세서리', comment: '수건걸이,휴지걸이' },
  { item_name: '변기', comment: '아메리칸스탠다드기준 투피스' },
  { item_name: '세면대', comment: '아메리칸스탠다드기준' },
  { item_name: '환풍기', comment: '힘펠 휴젠뜨 2.5 버전 기준' },
  { item_name: '욕실 천장', comment: '천장 smc자재 + 시공비' },
  { item_name: '배송비용', comment: '도기 화물차배송' },
  { item_name: '3인치 매입등', comment: '3인치 COB 매입등' },
  { item_name: '간접등', comment: 'T5 LED(900mm)' },
  { item_name: '브랜드 스위치', comment: '스위치 : 르그랑 또는 융\n콘센트 및 기타 : 르그랑 아펠라 기본형' },
  { item_name: '현관센서 인체감지기', comment: '히든센서' },
  { item_name: '조명셋팅', comment: '포인트 조명 세팅' },
  { item_name: '콘센트셋팅', comment: '포인트 고급 콘센트 세팅 인건비' },
  { item_name: '원목마루', comment: '지복득 원목마루(로스포함, 모델에 따라 변동)' },
  { item_name: '강마루', comment: '구정마루 광폭강마루\n(로스포함, 모델에 따라 변동)' },
  { item_name: '온돌마루', comment: '구정마루 포레스타G\n(로스포함, 모델에 따라 변동)' },
  { item_name: '셀프레벨링', comment: '수평몰탈 작업, 필요시 협의 후 진행' },
  { item_name: '신발장', comment: 'PET지정컬러' },
  { item_name: '현관 펜트리 수납장', comment: 'PET지정컬러' },
  { item_name: '주방가구', comment: 'PET지정컬러 / 블럼인티보서랍재 기본6개 적용' },
  { item_name: '주방수전', comment: '그로헤 민타 크롬\n수전 종류에 따라 비용 변동있음.' },
  { item_name: '씽크볼', comment: '백조 깜뽀르테 960\n종류에 따라 비용 변동있음.' },
  { item_name: '후드', comment: '엘리카 제니스2 아일랜드 후드\n종류에 따라 비용 변동있음.' },
  { item_name: '인덕션', comment: '밀레 후드일체형 인덕션\n(고객 구매)' },
  { item_name: '주방 상판', comment: '세라믹상판 1장당 자재비 + 시공비' },
  { item_name: '드레스룸 제작가구', comment: '11자 구성 30자 기준 견적금액\n제작 방식, 소재, 구성에 따라 비용변동' },
  { item_name: '붙박이장', comment: 'PET지정컬러 (실측 후 변동가능)' },
  { item_name: '발코니 창고장', comment: 'PET지정컬러' },
  { item_name: '거실 책장 제작', comment: 'PET지정컬러 (실측 후 변동가능)' },
  { item_name: '보강 및 기타', comment: '금속 하지 보강 재료비 + 인건비' },
  { item_name: '금속 선반', comment: '사이즈에 따라 변동가능' },
  { item_name: '시스템 에어컨', comment: '삼성무풍 6대 냉방기 기준\n(브랜드, 모델에 따라 변동가능)' },
  { item_name: '원격 제어 시스템', comment: '별도 견적' },
  { item_name: '공기청정 시스템', comment: '별도 견적' },
  { item_name: '커튼 블라인드', comment: '(커튼 및 홈스타일링 제품은 별도 견적 입니다.)\n(기본 베이스 조명은 포함이고, 포인트 벽등 또는 펜던트는 별도 금액입니다.)' },
  { item_name: '현관방화문 부속교체', comment: '클로저, 말발굽, 보조키마개, 우유투입구마개' },
]

// work_type 구분이 필요한 항목
const updatesWithWorkType = [
  { item_name: '부자재', work_type: '도장', comment: '카바링, 핸디, 망사, 실리콘, 사포, 포리퍼티 등' },
  { item_name: '부자재', work_type: '도배', comment: '실크벽지 부자재' },
  { item_name: '운임', work_type: '가구', comment: '3.5t 한대' },
  // 타일 부자재 (work_type 없이 item_name만으로 특정)
  { item_name: '부자재', work_type: '타일', comment: '드라이픽스,압착,코너비드 외' },
  // 운임 (타일 공종)
  { item_name: '운임', work_type: '타일', comment: '화물파레트' },
]

async function run() {
  // comment 컬럼 존재 여부 확인
  const { data: testRow, error: testErr } = await sb
    .from('quote_templates')
    .select('comment')
    .limit(1)

  if (testErr && testErr.message.includes('does not exist')) {
    console.error('❌ comment 컬럼이 아직 없습니다.')
    console.error('Supabase 대시보드 SQL 에디터에서 먼저 실행하세요:')
    console.error('ALTER TABLE quote_templates ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT \'\';')
    console.error('URL: https://supabase.com/dashboard/project/rvkpwclnmwzsulomoppq/editor')
    process.exit(1)
  }

  console.log('✅ comment 컬럼 확인됨. 데이터 업데이트 시작...')
  let ok = 0, fail = 0

  for (const u of updates) {
    const { error } = await sb
      .from('quote_templates')
      .update({ comment: u.comment })
      .eq('item_name', u.item_name)
    if (error) { console.error(`  ❌ ${u.item_name}: ${error.message}`); fail++ }
    else { ok++ }
  }

  for (const u of updatesWithWorkType) {
    const { error } = await sb
      .from('quote_templates')
      .update({ comment: u.comment })
      .eq('item_name', u.item_name)
      .eq('work_type', u.work_type)
    if (error) { console.error(`  ❌ ${u.item_name}(${u.work_type}): ${error.message}`); fail++ }
    else { ok++ }
  }

  console.log(`\n완료: 성공 ${ok}개, 실패 ${fail}개`)
}

run().catch(console.error)
