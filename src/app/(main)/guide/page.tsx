import { HelpCircle } from 'lucide-react'

export default function GuidePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
          <HelpCircle size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">로멘토 사용 가이드</h2>
          <p className="text-sm text-gray-500 mt-0.5">팀원 베타 테스트용. 견적 작성부터 정산·대시보드까지.</p>
        </div>
      </div>

      <div className="space-y-5">
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">1. 시작하기 — 전체 흐름</h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>로멘토는 인테리어 견적을 만들고, 공사 진행에 따라 실제 비용과 이윤을 관리하는 시스템입니다.</p>
            <p className="text-gray-600">
              ① 프로젝트 만들기 → ② 견적서 작성(기본 포맷 복사) → ③ 계약 → ④ 정산(실제 비용 입력) → ⑤ 대시보드로 관리
            </p>
            <p className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-gray-800">
              <span className="font-semibold text-blue-700">핵심:</span> &ldquo;기본 견적 포맷&rdquo;을 미리 만들어두고, 프로젝트마다 복사해서 견적서를 만듭니다.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">2. 프로젝트 만들기</h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>좌측 메뉴 <strong className="text-gray-900">프로젝트 → 새 프로젝트</strong>에서 생성합니다.</p>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li>프로젝트명, 현장 주소, 면적, 상태 입력</li>
              <li>
                <strong className="text-gray-900">담당자 등록:</strong> PM, 디자이너, 현장소장을 각각 여러 명 추가 가능
                (+추가 버튼). 마이너스 알림 SMS는 이들에게 발송됩니다.
              </li>
              <li><strong className="text-gray-900">고객:</strong> 입금 알림을 받을 고객 정보</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">3. 견적서 작성</h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>프로젝트 상세 페이지에서 <strong className="text-gray-900">새 견적서 작성</strong>을 누릅니다.</p>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li><strong className="text-gray-900">평형 선택:</strong> 상단 평형 탭(20~100평대이상)에서 평형을 고르면 미리 만들어둔 기본 포맷이 자동으로 불러와집니다.</li>
              <li>평형을 바꾸면 &ldquo;기존 입력 항목은 초기화됩니다&rdquo; 확인창이 뜹니다. 작업 중이던 내용이 있으면 주의하세요.</li>
              <li>불러온 항목은 자유롭게 수정·추가·삭제할 수 있고, 원본 기본 포맷에는 영향을 주지 않습니다(복사본).</li>
              <li><strong className="text-gray-900">평수 입력 + 수량 자동계산</strong>으로 면적에 맞춰 수량을 한 번에 조정할 수 있습니다.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-1">4. 계약견적서 vs 정산견적서</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-y border-gray-100">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 w-32">구분</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500">계약견적서</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500">정산견적서</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">용도</td>
                <td className="px-5 py-3 text-sm text-gray-700">고객에게 제시하는 견적</td>
                <td className="px-5 py-3 text-sm text-gray-700">공사 진행 중 실제 비용 관리</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">실제실행가</td>
                <td className="px-5 py-3 text-sm text-gray-500">입력 안 함</td>
                <td className="px-5 py-3 text-sm text-gray-700">공사하면서 실제 든 비용 입력</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">이윤</td>
                <td className="px-5 py-3 text-sm text-gray-700">목표(기업이윤율) 기준</td>
                <td className="px-5 py-3 text-sm text-gray-700">실제 비용 기준으로 계산</td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-3 bg-blue-50 border-t border-blue-100 text-sm text-blue-800">
            → 대시보드와 진행 관리는 <strong>정산견적서</strong>를 기준으로 동작합니다.
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">
            5. 정산 관리
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2 align-middle">핵심 기능</span>
          </h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>정산견적서를 열면 공종별 항목이 있고, 각 항목에 <strong className="text-gray-900">실제실행가</strong>를 입력합니다.</p>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li><strong className="text-gray-900">목표 이윤율:</strong> 견적 합계표 상단에서 설정. 아직 정산 안 된 항목의 예상 이윤 계산 기준.</li>
              <li><span className="text-gray-500 font-medium">예상실행가(회색):</span> 아직 실제 비용을 안 넣은 항목은 목표 이윤율 기준으로 자동 추정.</li>
              <li><span className="text-gray-900 font-medium">실제실행가 입력(검정):</span> 실제 든 비용을 넣으면 그 항목이 &ldquo;확정&rdquo;됩니다.</li>
              <li>
                <strong className="text-gray-900">0원 입력 가능:</strong> 비용이 안 든 항목은 0을 입력.{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700">빈칸 = 미입력</code>,{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700">0 = 확정 0원</code>으로 구분됩니다.
              </li>
              <li><strong className="text-gray-900">공종 단위 확정:</strong> 한 공종의 모든 항목에 실제값이 들어가야 그 공종이 &ldquo;확정&rdquo;됩니다.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">6. 대시보드 보기</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              좌측 <strong className="text-gray-900">대시보드</strong>는 진행 중인 프로젝트(정산견적서가 있는)를 한눈에 보여줍니다.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-y border-gray-100">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 w-48">컬럼</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500">의미</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">진행률</td>
                <td className="px-5 py-3 text-sm text-gray-700">전체 공종 중 몇 개가 확정됐는지 (예: 4/19)</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">현재까지 예상 이윤</td>
                <td className="px-5 py-3 text-sm text-gray-700">확정분은 실제값 + 미확정분은 목표 이윤율로 추정한 예상 이익</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-xs font-semibold text-gray-700">마이너스</td>
                <td className="px-5 py-3 text-sm text-gray-700">견적보다 실제 비용이 더 든 항목 수. 빨간 ⚠ 표시</td>
              </tr>
            </tbody>
          </table>
          <div className="p-6 pt-4 text-sm text-gray-700 leading-relaxed">
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li>마이너스 행은 빨간 배경으로 강조됩니다.</li>
              <li>마이너스 ⚠ 건수를 클릭하면 담당자에게 알림 SMS를 보낼 수 있습니다.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">7. 단가 관리</h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p><strong className="text-gray-900">단가 마스터</strong>(비밀번호 보호)에서 모든 단가를 한 곳에서 관리합니다.</p>
            <ul className="list-disc list-outside ml-5 space-y-1.5">
              <li>
                단가 마스터에서 단가를 바꾼 뒤, <strong className="text-gray-900">기본 견적 포맷</strong> 페이지에서{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700">단가 초기화</code> 버튼을 누르면 모든 평형의 기본 포맷에 한 번에 반영됩니다.
              </li>
              <li>단, <strong className="text-gray-900">이미 만들어진 프로젝트 견적서에는 영향이 없습니다</strong>(계약/정산은 그대로 유지).</li>
              <li>
                포맷에서 수정한 단가를 거꾸로 마스터에 저장하려면{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-gray-700">단가 마스터에 반영</code> 버튼을 씁니다.
              </li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">8. 핵심 개념 정리</h3>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <ul className="list-disc list-outside ml-5 space-y-2">
              <li>
                <strong className="text-gray-900">예상 이윤</strong> vs <strong className="text-gray-900">현재까지 이윤(확정)</strong>:
                예상 이윤은 &ldquo;이대로 가면 최종 얼마 남을지&rdquo; 예측치, 현재까지 이윤은 &ldquo;지금까지 확정된 공종에서 실제로 남은&rdquo; 금액.
              </li>
              <li><strong className="text-gray-900">진행률:</strong> 항목이 있는 공종 중 모든 항목이 입력 완료된 공종의 비율.</li>
              <li><strong className="text-gray-900">마이너스:</strong> 실제 비용이 견적금액을 초과한 항목. 손해 구간이라 알림이 필요.</li>
            </ul>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">9. 자주 묻는 질문 / 주의사항</h3>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <div>
              <p className="font-semibold text-gray-900 mb-1">Q. 평형 탭을 바꾸면 입력한 게 사라지나요?</p>
              <p>네, 확인창이 뜹니다. 작업 중이면 취소하세요.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Q. &ldquo;단가 초기화&rdquo;를 누르면 내가 만든 견적서도 바뀌나요?</p>
              <p>아니요. 기본 포맷에만 반영되고, 이미 만든 프로젝트 견적서는 그대로입니다.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Q. 실제 비용이 0원인 항목은?</p>
              <p>0을 직접 입력하세요. 빈칸과 0은 다릅니다.</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-1">Q. 견적서를 저장 안 하면?</p>
              <p>견적금액이 갱신되지 않을 수 있습니다. 수정 후 꼭 저장하세요.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
