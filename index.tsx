import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import * as XLSX from 'xlsx';

// --- 데이터 구조 정의 ---
interface Member {
  id: number;
  name: string;
  position: string;
}

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
  amount: number;
  memberId?: number;
  memo?: string;
}

interface DataSnapshot {
  timestamp: string;
  data: {
    members: Member[];
    transactions: Transaction[];
    expenseCategories: string[];
    incomeCategories: string[];
    festivalCategories: string[];
    otherIncomeCategories: string[];
    expenseSubCategories?: Record<string, string[]>;
  };
}

// --- 상수 정의 ---
const POSITIONS = ["목사", "사모", "부목사", "전도사", "장로", "권사", "집사", "성도", "청년", "중고등부", "주일학교", "무명", "기타"];
const DEFAULT_INCOME_CATEGORIES = [
  "십일조", "주일헌금", "감사헌금", "선교헌금", "건축헌금", "절기헌금", 
  "사경회헌금", "총회주일헌금", "기타수입", "이월금", "예비비", "기타헌금"
];
const DEFAULT_EXPENSE_CATEGORIES = [
  "교회관리비", "교육비", "목회자가정", "목회사역", "심방", "예배", 
  "전도,홍보,새신자", "친교", "사무행정", "교회차량관리", "부교역자", "예비비", "기타"
];
const DEFAULT_FESTIVAL_CATEGORIES = [
  "신년감사", "부활감사", "맥추감사", "추수감사", "성탄감사", "성령강림", "송구영신"
];
const DEFAULT_OTHER_INCOME_CATEGORIES = [
  "생일감사", "심방감사", "일천번제", "외부후원금", "목적헌금", "장학지원헌금"
];

// 지출 세부 항목 기본값
const DEFAULT_EXPENSE_SUB_CATEGORIES: Record<string, string[]> = {
  "교육비": [
    "교육자료(교재 및 성경)", "수련회(행사)", "주일학교(교육,지원)", "주일학교(운영비)", "강사비", "교육 예비비", "기타"
  ],
  "교회관리비": [
    "건물관리비", "비품구입비", "홈페이지관리비", "금융관리", "선교구제장학금", "건축헌금", "사택관리", "복사기(임대)", "복사기(자체)", "전기요금", "전화요금", "가스요금", "정수기(1층)", "정수기(2층)", "대출이자상환금", "인터넷", "예비비", "기타"
  ],
  "목회자가정": [
    "생활비", "상여금", "휴가비", "국민연금", "건강보험", "은퇴적립금", "은급비", "예비비"
  ],
  "목회사역": [
    "목회자도서비", "목회대외협력비", "목회용품", "목회사역비", "목회교육비", "목회(교육) 수련비", "예비비", "기타"
  ],
  "심방": [
    "교우심방", "교제 섬김", "축하", "부의", "기타"
  ],
  "예배": [
    "강단(교회) 미화", "절기장식", "현수막", "예배용품(음향)", "기타"
  ],
  "전도,홍보,새신자": [
    "전도활동비", "교회(전도)행사", "새신자", "교회홍보", "예비비", "기타"
  ],
  "친교": [
    "봉사위원회", "친교용품", "접대비", "행사(교제)", "주방", "예비비", "기타"
  ],
  "사무행정": [
    "달력", "행정소모품", "노회상회비", "노회선교분담금", "총회주일헌금", "기타행정(사무실)", "예비비"
  ],
  "교회차량관리": [
    "승용차량세금", "승용차연료비", "승용차유지보수", "승합차량세금", "승합차량연료비", "승합차량유지보수", "보험료", "월불입금", "예비비", "기타"
  ],
  "부교역자": [
    "부교역자사례비", "학업지원금", "기타지원", "예비비"
  ],
  "예비비": [
    "교회시설, 시스템", "예비비"
  ]
};

const KOREAN_CONSONANTS = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

const todayString = () => new Date().toISOString().slice(0, 10);

const getDayOfWeek = (dateString: string): string => {
    if (!dateString) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(`${dateString}T00:00:00`);
    if (isNaN(date.getTime())) return ''; 
    return `(${days[date.getDay()]})`;
};

const getInitialConsonant = (name: string): string => {
  const charCode = name.charCodeAt(0) - 0xAC00;
  if (charCode < 0 || charCode > 11171) return ''; // 한글이 아님
  const choseongIndex = Math.floor(charCode / 588);
  const choseongs = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const res = choseongs[choseongIndex];
  // 쌍자음을 단자음으로 매핑
  if (res === 'ㄲ') return 'ㄱ';
  if (res === 'ㄸ') return 'ㄷ';
  if (res === 'ㅃ') return 'ㅂ';
  if (res === 'ㅆ') return 'ㅅ';
  if (res === 'ㅉ') return 'ㅈ';
  return res;
};

const renderCategory = (category: string) => {
  const match = category.match(/^(.*) \(세부\) \((.*)\)$/);
  if (match) {
    const [_, main, sub] = match;
    return `${main} (${sub})`;
  }
  return category;
};

function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`localStorage 읽기 오류 “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`localStorage 쓰기 오류 “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

const PasswordModal: React.FC<{
  mode: 'create' | 'enter';
  onClose: () => void;
  onConfirm: (password: string) => void;
}> = ({ mode, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    onConfirm(password);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>{mode === 'create' ? '비밀번호 설정' : '비밀번호 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password-input">{mode === 'create' ? '새 비밀번호 (4자리 숫자)' : '비밀번호'}</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              autoComplete="new-password"
              required
              autoFocus
            />
          </div>
          {mode === 'create' && (
            <div className="form-group">
              <label htmlFor="confirm-password-input">비밀번호 확인</label>
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                maxLength={4}
                inputMode="numeric"
                autoComplete="new-password"
                required
              />
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="submit-btn full-width">확인</button>
        </form>
      </div>
    </div>
  );
};

// --- 공통 금액 도우미 컴포넌트 ---
const QuickAmountSelector: React.FC<{
  currentAmount: number | '';
  onChange: (amount: number | '') => void;
}> = ({ currentAmount, onChange }) => {
  // 요청하신 대로 상세 금액 프리셋 구성
  const presets = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];
  const handleAdd = (val: number) => {
    onChange((Number(currentAmount) || 0) + val);
  };

  return (
    <div className="quick-amount-container">
      <div className="quick-amount-grid">
        {presets.map(val => (
          <button 
            key={val} 
            type="button" 
            className="quick-amount-btn" 
            onClick={() => handleAdd(val)}
          >
            +{val.toLocaleString()}원
          </button>
        ))}
        <button 
          type="button" 
          className="quick-amount-btn clear" 
          onClick={() => onChange('')}
          title="금액 초기화"
        >
          초기화
        </button>
      </div>
    </div>
  );
};

// --- 성도 즉시 선택 컴포넌트 (개선됨) ---
const MemberQuickPicker: React.FC<{
  members: Member[];
  selectedId: number | '';
  onSelect: (id: number) => void;
  consonantFilter: string | null;
  onConsonantSelect: (consonant: string | null) => void;
  label: string;
}> = ({ members, selectedId, onSelect, consonantFilter, onConsonantSelect, label }) => {
  const [showAllModal, setShowAllModal] = useState(false);

  const filteredMembers = useMemo(() => {
    if (!consonantFilter) return []; // 초성이 선택되지 않으면 빈 목록
    return members.filter(m => getInitialConsonant(m.name) === consonantFilter);
  }, [members, consonantFilter]);

  const selectedMember = members.find(m => m.id === selectedId);

  // 성도가 이미 선택되었다면 그 한 명만 보여주고, 아니면 검색된 목록 전체를 보여줌
  const displayMembers = selectedId && selectedMember ? [selectedMember] : filteredMembers;

  const handleMemberClick = (id: number) => {
    if (selectedId === id) {
      onSelect('' as any);
    } else {
      onSelect(id);
      const m = members.find(x => x.id === id);
      if (m) onConsonantSelect(getInitialConsonant(m.name));
    }
  };

  const handleConsonantClick = (c: string) => {
      // 새 초성을 누르면 기존 선택된 성도는 해제하고 목록을 보여줌 (즉시 변경 지원)
      if (consonantFilter === c) {
          onConsonantSelect(null);
      } else {
          onSelect('' as any);
          onConsonantSelect(c);
      }
  };

  const handleSelectFromModal = (id: number) => {
      onSelect(id);
      const m = members.find(x => x.id === id);
      if (m) onConsonantSelect(getInitialConsonant(m.name));
      setShowAllModal(false);
  };

  return (
    <div className="form-group full-width member-selection-area">
      <div className="section-header-row">
        <label className="section-label">{label}</label>
        <button type="button" className="view-all-btn" onClick={() => setShowAllModal(true)}>전체보기</button>
      </div>
      
      {/* 초성 필터 영역: 항상 표시되도록 변경 */}
      <div className="consonant-filter-container">
        {KOREAN_CONSONANTS.map(c => (
          <button 
            key={c}
            type="button" 
            className={`consonant-btn ${consonantFilter === c ? 'active' : ''}`}
            onClick={() => handleConsonantClick(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 성도 명단 영역: 초성이 선택된 경우에만 표시 */}
      {consonantFilter && (
        <div className={`member-chips-container ${selectedId ? 'selection-made' : ''}`}>
          <div className="member-chips-scroll-area">
            {displayMembers.map(m => (
              <button
                key={m.id}
                type="button"
                className={`member-chip ${selectedId === m.id ? 'active' : ''}`}
                onClick={() => handleMemberClick(m.id)}
              >
                {selectedId === m.id ? (
                  <span className="chip-combined">{m.name} {m.position}</span>
                ) : (
                  <>
                    <span className="chip-name">{m.name}</span>
                    <span className="chip-pos">{m.position}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 전체 성도 명단 모달 */}
      {showAllModal && (
          <div className="modal-backdrop" style={{zIndex: 2000}}>
              <div className="modal-content large" style={{maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
                  <button onClick={() => setShowAllModal(false)} className="close-btn">&times;</button>
                  <h2 style={{marginBottom: '1rem', borderBottom: '2px solid var(--primary-color)', paddingBottom: '0.5rem'}}>성도 전체 명단</h2>
                  <div className="modal-all-members-grid">
                      {KOREAN_CONSONANTS.map(consonant => {
                          const group = members.filter(m => getInitialConsonant(m.name) === consonant);
                          if (group.length === 0) return null;
                          return (
                              <div key={consonant} className="member-group-section">
                                  <h3 className="group-title">{consonant}</h3>
                                  <div className="group-chips">
                                      {group.map(m => (
                                          <button key={m.id} type="button" className="member-chip small" onClick={() => handleSelectFromModal(m.id)}>
                                              <span className="chip-name">{m.name}</span>
                                              <span className="chip-pos">{m.position}</span>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          );
                      })}
                      {members.filter(m => !getInitialConsonant(m.name)).length > 0 && (
                          <div className="member-group-section">
                              <h3 className="group-title">기타</h3>
                              <div className="group-chips">
                                  {members.filter(m => !getInitialConsonant(m.name)).map(m => (
                                      <button key={m.id} type="button" className="member-chip small" onClick={() => handleSelectFromModal(m.id)}>
                                          <span className="chip-name">{m.name}</span>
                                          <span className="chip-pos">{m.position}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'main' | 'addMember' | 'search' | 'editMembers' | 'snapshots'>('main');
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [churchName, setChurchName] = usePersistentState<string>('church_name_v1', '구미은혜로교회');
  const [members, setMembers] = usePersistentState<Member[]>('church_members_v2', []);
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('church_transactions_v2', []);
  const [expenseCategories, setExpenseCategories] = usePersistentState<string[]>('church_expense_categories_v3', DEFAULT_EXPENSE_CATEGORIES);
  const [incomeCategories, setIncomeCategories] = usePersistentState<string[]>('church_income_categories_v2', DEFAULT_INCOME_CATEGORIES);
  const [festivalCategories, setFestivalCategories] = usePersistentState<string[]>('church_festival_categories_v1', DEFAULT_FESTIVAL_CATEGORIES);
  const [otherIncomeCategories, setOtherIncomeCategories] = usePersistentState<string[]>('church_other_income_categories_v1', DEFAULT_OTHER_INCOME_CATEGORIES);
  
  const [expenseSubCategories, setExpenseSubCategories] = usePersistentState<Record<string, string[]>>('church_expense_sub_categories_v13', DEFAULT_EXPENSE_SUB_CATEGORIES);

  const [password, setPassword] = usePersistentState<string | null>('church_app_password_v2', null);
  const [snapshots, setSnapshots] = usePersistentState<DataSnapshot[]>('church_data_snapshots_v1', []);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showIncomeCategoryManager, setShowIncomeCategoryManager] = useState(false);
  const [showFestivalCategoryManager, setShowFestivalCategoryManager] = useState(false);
  const [showOtherIncomeCategoryManager, setShowOtherIncomeCategoryManager] = useState(false);
  const [showExpenseSubCategoryManager, setShowExpenseSubCategoryManager] = useState<{main: string} | null>(null);
  const [showChurchNameModal, setShowChurchNameModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  
  const [showIncomeSummaryModal, setShowIncomeSummaryModal] = useState(false);
  const [showExpenseSummaryModal, setShowExpenseSummaryModal] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalProps, setPasswordModalProps] = useState({
      mode: 'enter' as 'create' | 'enter',
      onConfirm: (pw: string) => {},
      onClose: () => setShowPasswordModal(false)
  });

  const sortedExpenseCategories = useMemo(() => 
    [...expenseCategories].sort((a, b) => a.localeCompare(b, 'ko')), 
    [expenseCategories]
  );

  const handleAddMember = (name: string, position: string) => {
    if (!name.trim()) {
        alert("성도 이름을 입력해주세요.");
        return;
    }
    const newMember: Member = { id: Date.now(), name, position };
    setMembers(prev => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    setView('main');
  };

  const handleUpdateMember = (id: number, name: string, position: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name, position } : m)
                           .sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  };
  
  const handleDeleteMember = (id: number) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleAddTransaction = (tx: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [...prev, { ...tx, id: Date.now() }]);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: number) => {
      setTransactions(prev => prev.filter(tx => tx.id !== id));
  };
  
  const handleAddExpenseCategory = (category: string) => {
    if (category && !expenseCategories.includes(category)) {
      setExpenseCategories(prev => [...prev, category].sort((a, b) => a.localeCompare(b, 'ko')));
    }
  };

  const handleAddExpenseSubCategory = (main: string, sub: string) => {
    setExpenseSubCategories(prev => {
        const subs = prev[main] || [];
        if (subs.includes(sub)) return prev;
        return { ...prev, [main]: [...subs, sub] };
    });
  };

  const handleAddIncomeCategory = (category: string) => {
    if (category && !incomeCategories.includes(category)) {
        setIncomeCategories(prev => [...prev, category]);
    }
  };

  const handleAddFestivalCategory = (category: string) => {
    if (category && !festivalCategories.includes(category)) {
        setFestivalCategories(prev => [...prev, category]);
    }
  };

  const handleAddOtherIncomeCategory = (category: string) => {
    if (category && !otherIncomeCategories.includes(category)) {
        setOtherIncomeCategories(prev => [...prev, category]);
    }
  };
  
  const handleUpdateExpenseCategory = (oldName: string, newName: string) => {
    if (expenseCategories.includes(newName)) {
      alert('이미 존재하는 항목 이름입니다.');
      return;
    }
    setExpenseCategories(prev => prev.map(c => c === oldName ? newName : c).sort((a, b) => a.localeCompare(b, 'ko')));
    
    setExpenseSubCategories(prev => {
        const newMap = { ...prev };
        if (newMap[oldName]) {
            newMap[newName] = newMap[oldName];
            delete newMap[oldName];
        }
        return newMap;
    });

    setTransactions(prev => prev.map(tx => {
        if (tx.type === 'expense' && tx.category === oldName) {
             return { ...tx, category: newName };
        } else if (tx.type === 'expense' && tx.category.startsWith(`${oldName} (세부) (`)) {
             return { ...tx, category: tx.category.replace(`${oldName} (세부) (`, `${newName} (세부) (`) };
        }
        return tx;
    }));
  };

  const handleUpdateExpenseSubCategory = (main: string, oldSub: string, newSub: string) => {
    setExpenseSubCategories(prev => ({
        ...prev,
        [main]: (prev[main] || []).map(s => s === oldSub ? newSub : s)
    }));
    setTransactions(prev => prev.map(tx => 
        (tx.type === 'expense' && tx.category === `${main} (세부) (${oldSub})`)
        ? { ...tx, category: `${main} (세부) (${newSub})` }
        : tx
    ));
  };

  const handleUpdateIncomeCategory = (oldName: string, newName: string) => {
    if (incomeCategories.includes(newName)) {
        alert('이미 존재하는 항목 이름입니다.');
        return;
    }
    setIncomeCategories(prev => prev.map(c => c === oldName ? newName : c));
    setTransactions(prev => prev.map(tx => 
        (tx.type === 'income' && tx.category === oldName) 
        ? { ...tx, category: newName } 
        : tx
    ));
  };

  const handleUpdateFestivalCategory = (oldName: string, newName: string) => {
    if (festivalCategories.includes(newName)) {
        alert('이미 존재하는 항목 이름입니다.');
        return;
    }
    setFestivalCategories(prev => prev.map(c => c === oldName ? newName : c));
    setTransactions(prev => prev.map(tx => 
        (tx.type === 'income' && tx.category === `절기헌금 (세부) (${oldName})`) 
        ? { ...tx, category: `절기헌금 (세부) (${newName})` } 
        : tx
    ));
  };

  const handleUpdateOtherIncomeCategory = (oldName: string, newName: string) => {
    if (otherIncomeCategories.includes(newName)) {
        alert('이미 존재하는 항목 이름입니다.');
        return;
    }
    setOtherIncomeCategories(prev => prev.map(c => c === oldName ? newName : c));
    setTransactions(prev => prev.map(tx => 
        (tx.type === 'income' && tx.category === `기타헌금 (세부) (${oldName})`) 
        ? { ...tx, category: `기타헌금 (세부) (${newName})` } 
        : tx
    ));
  };

  const handleDeleteExpenseCategory = (categoryName: string) => {
      const isUsed = transactions.some(tx => tx.type === 'expense' && (tx.category === categoryName || tx.category.startsWith(`${categoryName} (세부) (`)));
      let message = `'${categoryName}' 항목을 삭제하시겠습니까?`;
      if (isUsed) {
          message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.\n항목을 삭제해도 기존 내역은 유지되지만, 목록에서 사라집니다.`;
      }
      if (window.confirm(message)) {
          setExpenseCategories(prev => prev.filter(c => c !== categoryName));
          setExpenseSubCategories(prev => {
              const newMap = { ...prev };
              delete newMap[categoryName];
              return newMap;
          });
      }
  };

  const handleDeleteExpenseSubCategory = (main: string, subName: string) => {
      const fullCategoryName = `${main} (세부) (${subName})`;
      const isUsed = transactions.some(tx => tx.type === 'expense' && tx.category === fullCategoryName);
      let message = `'${subName}' 세부 항목을 삭제하시겠습니까?`;
      if (isUsed) {
          message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.`;
      }
      if (window.confirm(message)) {
          setExpenseSubCategories(prev => ({
              ...prev,
              [main]: (prev[main] || []).filter(s => s !== subName)
          }));
      }
  };

  const handleDeleteIncomeCategory = (categoryName: string) => {
    const isUsed = transactions.some(tx => tx.type === 'income' && tx.category === categoryName);
    let message = `'${categoryName}' 항목을 삭제하시겠습니까?`;
    if (isUsed) {
        message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.\n항목을 삭제해도 기존 내역은 유지되지만, 목록에서 사라집니다.`;
    }
    if (window.confirm(message)) {
        setIncomeCategories(prev => prev.filter(c => c !== categoryName));
    }
  };

  const handleDeleteFestivalCategory = (categoryName: string) => {
    const fullCategoryName = `절기헌금 (세부) (${categoryName})`;
    const isUsed = transactions.some(tx => tx.type === 'income' && tx.category === fullCategoryName);
    let message = `'${categoryName}' 절기를 삭제하시겠습니까?`;
    if (isUsed) {
        message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.`;
    }
    if (window.confirm(message)) {
        setFestivalCategories(prev => prev.filter(c => c !== categoryName));
    }
  };

  const handleDeleteOtherIncomeCategory = (categoryName: string) => {
    const fullCategoryName = `기타헌금 (세부) (${categoryName})`;
    const isUsed = transactions.some(tx => tx.type === 'income' && tx.category === fullCategoryName);
    let message = `'${categoryName}' 항목을 삭제하시겠습니까?`;
    if (isUsed) {
        message += `\n\n주의: 이 항목을 사용하는 기존 거래 내역이 있습니다.`;
    }
    if (window.confirm(message)) {
        setOtherIncomeCategories(prev => prev.filter(c => c !== categoryName));
    }
  };

  const runProtectedAction = (action: () => void) => {
    if (password) {
      setPasswordModalProps({
        mode: 'enter',
        onConfirm: (enteredPassword) => {
          if (enteredPassword === password) {
            setShowPasswordModal(false);
            action();
          } else {
            alert('비밀번호가 올바르지 않습니다.');
          }
        },
        onClose: () => setShowPasswordModal(false)
      });
    } else {
      setPasswordModalProps({
        mode: 'create',
        onConfirm: (newPassword) => {
          setPassword(newPassword);
          setShowPasswordModal(false);
          action();
        },
        onClose: () => setShowPasswordModal(false)
      });
    }
    setShowPasswordModal(true);
  };

  const handleSaveData = () => {
    const performSave = () => {
      try {
        const dataToSave = { members, transactions, expenseCategories, incomeCategories, festivalCategories, otherIncomeCategories, expenseSubCategories };
        const newSnapshot: DataSnapshot = {
          timestamp: new Date().toISOString(),
          data: dataToSave,
        };
        setSnapshots(prev => [newSnapshot, ...prev].slice(0, 50));
        const prettyJsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([prettyJsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `${churchName}_헌금_${todayString()}.json`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (window.confirm(`데이터가 앱 내 목록과 컴퓨터에 백업되었습니다.\n'${fileName}' 파일이 다운로드 폴더에 저장되었습니다.\n\n확인을 누르면 네이버 밴드로 이동하여 파일을 공유할 수 있습니다.`)) {
            window.open('https://band.us', '_blank');
        }
      } catch (error) {
        console.error('데이터 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }
    };
    runProtectedAction(performSave);
  };
  

  const handleLoadData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const inputElement = event.target;
    const performLoad = () => {
        if (!window.confirm('데이터를 불러오면 현재 데이터가 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
            inputElement.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("파일을 읽을 수 없습니다.");
                const parsedData = JSON.parse(text);
                if (typeof parsedData !== 'object' || parsedData === null || !Array.isArray(parsedData.members) || !Array.isArray(parsedData.transactions)) {
                    alert('파일의 데이터 구조가 올바르지 않아 불러올 수 없습니다.');
                    return;
                }
                setMembers(parsedData.members);
                setTransactions(parsedData.transactions);
                if (Array.isArray(parsedData.expenseCategories)) {
                    setExpenseCategories(parsedData.expenseCategories.sort((a: string, b: string) => a.localeCompare(b, 'ko')));
                }
                if (parsedData.expenseSubCategories) {
                    setExpenseSubCategories(parsedData.expenseSubCategories);
                }
                if (Array.isArray(parsedData.incomeCategories)) {
                    setIncomeCategories(parsedData.incomeCategories);
                } else {
                    setIncomeCategories(DEFAULT_INCOME_CATEGORIES);
                }
                if (Array.isArray(parsedData.festivalCategories)) {
                  setFestivalCategories(parsedData.festivalCategories);
                } else {
                  setFestivalCategories(DEFAULT_FESTIVAL_CATEGORIES);
                }
                if (Array.isArray(parsedData.otherIncomeCategories)) {
                  setOtherIncomeCategories(parsedData.otherIncomeCategories);
                } else {
                  setOtherIncomeCategories(DEFAULT_OTHER_INCOME_CATEGORIES);
                }
                alert('데이터를 성공적으로 불러왔습니다.');
            } catch (error) {
                console.error("데이터 불러오기 오류:", error);
                alert('데이터를 불러오는 중 오류가 발생했습니다. 파일이 손상되었거나 형식이 다를 수 있습니다.');
            } finally {
                inputElement.value = '';
            }
        };
        reader.readAsText(file);
    };
    runProtectedAction(performLoad);
  };

  const handleLoadMembersOnly = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const inputElement = event.target;
    const performLoad = () => {
        if (!window.confirm('기존 성도 목록을 불러온 데이터로 교체하고, 모든 거래 내역을 삭제하여 처음부터 시작하시겠습니까?')) {
            inputElement.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("파일을 읽을 수 없습니다.");
                const parsedData = JSON.parse(text);
                if (typeof parsedData !== 'object' || parsedData === null || !Array.isArray(parsedData.members)) {
                    alert('파일에 성도 데이터가 포함되어 있지 않습니다.');
                    return;
                }
                setMembers(parsedData.members);
                setTransactions([]); // Clear financial data as requested
                alert('성도 정보를 성공적으로 불러왔습니다. 재정 내역은 0원부터 다시 시작됩니다.');
                setView('main');
            } catch (error) {
                alert('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                inputElement.value = '';
            }
        };
        reader.readAsText(file);
    };
    runProtectedAction(performLoad);
  };
  
    const handleLoadSnapshot = (snapshotData: DataSnapshot['data']) => {
      if (window.confirm('저장된 데이터를 불러오면 현재 작업 내용이 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
          setMembers(snapshotData.members);
          setTransactions(snapshotData.transactions);
          setExpenseCategories((snapshotData.expenseCategories || []).sort((a, b) => a.localeCompare(b, 'ko')));
          setExpenseSubCategories(snapshotData.expenseSubCategories || {});
          setIncomeCategories(snapshotData.incomeCategories || DEFAULT_INCOME_CATEGORIES);
          setFestivalCategories(snapshotData.festivalCategories || DEFAULT_FESTIVAL_CATEGORIES);
          setOtherIncomeCategories(snapshotData.otherIncomeCategories || DEFAULT_OTHER_INCOME_CATEGORIES);
          setView('main');
          alert('데이터를 성공적으로 불러왔습니다.');
      }
    };

    const handleDeleteSnapshot = (timestamp: string) => {
        const performDelete = () => {
            if (window.confirm(`${new Date(timestamp).toLocaleString('ko-KR')}에 저장된 데이터를 삭제하시겠습니까?`)) {
                setSnapshots(prev => prev.filter(s => s.timestamp !== timestamp));
            }
        }
        runProtectedAction(performDelete);
    };

    const handleResetAll = () => {
        if (window.confirm('정말로 모든 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            if (window.confirm('성도 목록, 거래 내역, 설정이 모두 삭제됩니다. 정말로 초기화하시겠습니까?')) {
                localStorage.clear();
                window.location.reload();
            }
        }
    };

  const { sortedTransactions, balanceData, periodicalSummary, weeklyCategoryTotals, transactionsWithBalance, availableYears } = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    
    const todayStr = todayString();
    let previousBalance = 0;
    let todaysChange = 0;

    transactions.forEach(tx => {
        const amount = tx.type === 'income' ? tx.amount : -tx.amount;
        if (tx.date < todayStr) {
            previousBalance += amount;
        } else if (tx.date === todayStr) {
            todaysChange += amount;
        }
    });

    const todaysBalance = previousBalance + todaysChange;
    const categoryOrder = ["기타", "기타헌금", "일천번제", "심방감사", "생일감사", "절기헌금", "주일헌금", "주정헌금", "감사헌금", "건축헌금", "선교헌금", "십일조"];
    
    const getMemberNameForSort = (memberId?: number): string => {
        if (memberId === undefined) return '무명';
        return members.find(m => m.id === memberId)?.name || '미지정';
    };

    let runningBalance = 0;
    const withBalance = [...transactions]
        .sort((a, b) => {
            const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateCompare !== 0) return dateCompare;
            if (a.type !== b.type) {
                return a.type === 'income' ? -1 : 1;
            }
            if (a.type === 'income') {
                const indexA = categoryOrder.findIndex(cat => a.category.includes(cat));
                const indexB = categoryOrder.findIndex(cat => b.category.includes(cat));
                const effectiveIndexA = indexA === -1 ? categoryOrder.length : indexA;
                const effectiveIndexB = indexB === -1 ? categoryOrder.length : indexB;
                if (effectiveIndexA !== effectiveIndexB) {
                    return effectiveIndexA - effectiveIndexB;
                }
                const nameA = getMemberNameForSort(a.memberId);
                const nameB = getMemberNameForSort(b.memberId);
                const nameCompare = nameB.localeCompare(nameA, 'ko');
                if (nameCompare !== 0) return nameCompare;
            }
            if (a.type === 'expense') {
                const catCompare = b.category.localeCompare(a.category, 'ko');
                if (catCompare !== 0) return catCompare;
                const memoA = a.memo || '';
                const memoB = b.memo || '';
                const memoCompare = memoB.localeCompare(memoA, 'ko');
                if (memoCompare !== 0) return memoCompare;
            }
            return a.id - b.id;
        })
        .map(tx => {
            runningBalance += (tx.type === 'income' ? tx.amount : -tx.amount);
            return { ...tx, balance: runningBalance };
        })
        .reverse();
        
    const today = new Date(todayStr);
    const yearStartStr = today.getFullYear() + '-01-01';
    const selectedYearStartStr = `${selectedYear}-01-01`;
    const selectedYearEndStr = `${selectedYear}-12-31`;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); 
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let weeklyIncome = 0;
    let weeklyExpense = 0;
    let yearlyIncome = 0;
    let yearlyExpense = 0;
    
    const weeklyIncomeBreakdown: Record<string, number> = {};
    const yearlyIncomeBreakdown: Record<string, number> = {};
    const weeklyExpenseBreakdown: Record<string, number> = {};
    const yearlyExpenseBreakdown: Record<string, number> = {};

    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    
    transactions.forEach(tx => {
        const amount = tx.amount;
        const txDate = tx.date;
        const txYear = new Date(txDate).getFullYear();
        if (!isNaN(txYear)) yearsSet.add(txYear);

        const mainCat = tx.category.includes(' (세부) (') ? tx.category.split(' (세부) (')[0] : tx.category;

        if (txDate >= yearStartStr) {
            if (tx.type === 'income') yearlyIncome += amount;
            else yearlyExpense += amount;
        }

        if (txDate >= selectedYearStartStr && txDate <= selectedYearEndStr) {
            if (tx.type === 'income') {
                yearlyIncomeBreakdown[mainCat] = (yearlyIncomeBreakdown[mainCat] || 0) + amount;
            } else {
                yearlyExpenseBreakdown[mainCat] = (yearlyExpenseBreakdown[mainCat] || 0) + amount;
            }
        }

        if (txDate >= weekStartStr) {
            if (tx.type === 'income') {
                weeklyIncome += amount;
                weeklyIncomeBreakdown[mainCat] = (weeklyIncomeBreakdown[mainCat] || 0) + amount;
            } else {
                weeklyExpense += amount;
                weeklyExpenseBreakdown[mainCat] = (weeklyExpenseBreakdown[mainCat] || 0) + amount;
            }
        }
    });

    return {
      sortedTransactions: sorted,
      balanceData: { previousBalance, todaysChange, todaysBalance },
      periodicalSummary: {
          weeklyIncome,
          weeklyExpense,
          yearlyIncome,
          yearlyExpense,
          weeklyBalance: weeklyIncome - weeklyExpense,
          yearlyBalance: yearlyIncome - yearlyExpense,
      },
      weeklyCategoryTotals: {
          weeklyIncomeBreakdown,
          yearlyIncomeBreakdown,
          weeklyExpenseBreakdown,
          yearlyExpenseBreakdown
      },
      transactionsWithBalance: withBalance,
      availableYears: Array.from(yearsSet).sort((a, b) => b - a),
    };
  }, [transactions, members, selectedYear]);
  
  const getMemberName = (id?: number) => members.find(m => m.id === id)?.name || '미지정';

  return (
    <>
      <header>
        <div className="church-title-container" onClick={() => runProtectedAction(() => setShowChurchNameModal(true))}>
            <h1>{churchName} 헌금관리</h1>
            <span className="edit-badge">수정</span>
        </div>
        <div className="header-actions">
            <button onClick={() => setView('addMember')}>새 성도 추가</button>
            <button onClick={() => setView('search')}>조회</button>
            <button onClick={() => runProtectedAction(() => setView('editMembers'))}>회원수정</button>
            <button onClick={() => setView('snapshots')}>저장 목록</button>
        </div>
      </header>
      <div className="data-management top-data-management">
          <button onClick={() => setShowExcelModal(true)} className="data-btn excel-btn">엑셀로 저장</button>
          <button onClick={handleSaveData} className="data-btn">데이터 저장</button>
          <label htmlFor="load-data-input-header" className="data-btn">
              데이터 불러오기
          </label>
          <input 
              id="load-data-input-header"
              type="file"
              accept=".json"
              onChange={handleLoadData}
              style={{ display: 'none' }}
          />
      </div>
      <main>
        {view === 'main' && (
          <>
            <div className="card">
              <div className="tabs">
                <button className={`tab-button ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>입금</button>
                <button className={`tab-button ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>출금</button>
              </div>
              {activeTab === 'income' ? (
                <IncomeForm 
                    members={members} 
                    categories={incomeCategories}
                    festivals={festivalCategories}
                    otherCategories={otherIncomeCategories}
                    onAddCategory={handleAddIncomeCategory}
                    onAddFestival={handleAddFestivalCategory}
                    onAddOtherCategory={handleAddOtherIncomeCategory}
                    onAddTransaction={handleAddTransaction} 
                    onManageCategories={() => runProtectedAction(() => setShowIncomeCategoryManager(true))}
                    onManageFestivals={() => runProtectedAction(() => setShowFestivalCategoryManager(true))}
                    onManageOtherCategories={() => runProtectedAction(() => setShowOtherIncomeCategoryManager(true))}
                />
              ) : (
                <ExpenseForm 
                    members={members} 
                    categories={sortedExpenseCategories} 
                    subCategories={expenseSubCategories}
                    onAddCategory={handleAddExpenseCategory} 
                    onAddSubCategory={handleAddExpenseSubCategory}
                    onAddTransaction={handleAddTransaction} 
                    onManageCategories={() => runProtectedAction(() => setShowCategoryManager(true))}
                    onManageSubCategories={(main) => runProtectedAction(() => setShowExpenseSubCategoryManager({main}))}
                />
              )}
            </div>
            <PeriodicalSummary {...periodicalSummary} />
            
            <div className="summary-buttons-container" style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                    onClick={() => setShowIncomeSummaryModal(true)} 
                    className="summary-trigger-btn"
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#e3f2fd', color: '#1976d2', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(25,118,210,0.15)' }}
                >
                    입금 항목별집계
                </button>
                <button 
                    onClick={() => setShowExpenseSummaryModal(true)} 
                    className="summary-trigger-btn"
                    style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#ffebee', color: '#d32f2f', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(211,47,47,0.15)' }}
                >
                    출금 항목별집계
                </button>
            </div>

            <BalanceSummary {...balanceData} />
            <TransactionList 
              transactions={transactionsWithBalance} 
              getMemberName={getMemberName}
              onSaveData={handleSaveData}
              onLoadData={handleLoadData}
              onLoadMembersOnly={handleLoadMembersOnly}
              onEdit={tx => runProtectedAction(() => setEditingTransaction(tx))}
              onDelete={id => runProtectedAction(() => {
                  if (window.confirm('이 거래 내역을 정말로 삭제하시겠습니까?')) {
                      handleDeleteTransaction(id);
                  }
              })}
            />
          </>
        )}
        {view === 'addMember' && <AddMemberModal onAddMember={handleAddMember} onClose={() => setView('main')} />}
        {view === 'editMembers' && <EditMembersModal members={members} onClose={() => setView('main')} onUpdateMember={handleUpdateMember} onDeleteMember={handleDeleteMember} />}
        {view === 'search' && <SearchModal transactions={transactions} members={members} getMemberName={getMemberName} incomeCategories={incomeCategories} expenseCategories={sortedExpenseCategories} onClose={() => setView('main')} />}
        {view === 'snapshots' && <SnapshotsModal snapshots={snapshots} onClose={() => setView('main')} onLoad={handleLoadSnapshot} onDelete={handleDeleteSnapshot} />}
        
        {editingTransaction && (
            <EditTransactionModal
                transaction={editingTransaction}
                onClose={() => setEditingTransaction(null)}
                onSave={handleUpdateTransaction}
                members={members}
                incomeCategories={incomeCategories}
                expenseCategories={sortedExpenseCategories}
                expenseSubCategoriesMap={expenseSubCategories}
                festivalCategories={festivalCategories}
                otherIncomeCategories={otherIncomeCategories}
                onAddIncomeCategory={handleAddIncomeCategory}
                onAddExpenseCategory={handleAddExpenseCategory}
                onAddExpenseSubCategory={handleAddExpenseSubCategory}
                onAddFestivalCategory={handleAddFestivalCategory}
                onAddOtherIncomeCategory={handleAddOtherIncomeCategory}
            />
        )}
        
        {showExcelModal && (
            <ExcelExportModal 
                onClose={() => setShowExcelModal(false)} 
                transactions={transactions} 
                members={members} 
                availableYears={availableYears}
                churchName={churchName}
            />
        )}

        {showIncomeSummaryModal && (
            <CategorySummaryModal
                title="입금 항목별 집계"
                activeTab="income"
                weeklyData={weeklyCategoryTotals.weeklyIncomeBreakdown}
                yearlyData={weeklyCategoryTotals.yearlyIncomeBreakdown}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                availableYears={availableYears}
                categories={incomeCategories}
                onClose={() => setShowIncomeSummaryModal(false)}
            />
        )}

        {showExpenseSummaryModal && (
            <CategorySummaryModal
                title="출금 항목별 집계"
                activeTab="expense"
                weeklyData={weeklyCategoryTotals.weeklyExpenseBreakdown}
                yearlyData={weeklyCategoryTotals.yearlyExpenseBreakdown}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                availableYears={availableYears}
                categories={sortedExpenseCategories}
                onClose={() => setShowExpenseSummaryModal(false)}
            />
        )}

        {showPasswordModal && <PasswordModal {...passwordModalProps} />}
        {showCategoryManager && (
            <ManageCategoriesModal
                title="출금 항목 관리"
                categories={sortedExpenseCategories}
                onClose={() => setShowCategoryManager(false)}
                onUpdate={handleUpdateExpenseCategory}
                onDelete={handleDeleteExpenseCategory}
                onAdd={handleAddExpenseCategory}
            />
        )}
        {showExpenseSubCategoryManager && (
            <ManageCategoriesModal
                title={`'${showExpenseSubCategoryManager.main}' 세부 항목 관리`}
                categories={expenseSubCategories[showExpenseSubCategoryManager.main] || []}
                onClose={() => setShowExpenseSubCategoryManager(null)}
                onUpdate={(old, newN) => handleUpdateExpenseSubCategory(showExpenseSubCategoryManager.main, old, newN)}
                onDelete={(sub) => handleDeleteExpenseSubCategory(showExpenseSubCategoryManager.main, sub)}
                onAdd={(sub) => handleAddExpenseSubCategory(showExpenseSubCategoryManager.main, sub)}
            />
        )}
        {showIncomeCategoryManager && (
            <ManageCategoriesModal
                title="입금 항목 관리"
                categories={incomeCategories}
                onClose={() => setShowIncomeCategoryManager(false)}
                onUpdate={handleUpdateIncomeCategory}
                onDelete={handleDeleteIncomeCategory}
                onAdd={handleAddIncomeCategory}
            />
        )}
        {showFestivalCategoryManager && (
            <ManageCategoriesModal
                title="절기 항목 관리"
                categories={festivalCategories}
                onClose={() => setShowFestivalCategoryManager(false)}
                onUpdate={handleUpdateFestivalCategory}
                onDelete={handleDeleteFestivalCategory}
                onAdd={handleAddFestivalCategory}
            />
        )}
        {showOtherIncomeCategoryManager && (
            <ManageCategoriesModal
                title="기타헌금 세부 항목 관리"
                categories={otherIncomeCategories}
                onClose={() => setShowOtherIncomeCategoryManager(false)}
                onUpdate={handleUpdateOtherIncomeCategory}
                onDelete={handleDeleteOtherIncomeCategory}
                onAdd={handleAddOtherIncomeCategory}
            />
        )}
        {showChurchNameModal && (
            <div className="modal-backdrop">
                <div className="modal-content">
                    <button onClick={() => setShowChurchNameModal(false)} className="close-btn">&times;</button>
                    <h2>교회 이름 수정</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const newName = (e.target as any).churchName.value;
                        if (newName.trim()) {
                            setChurchName(newName.trim());
                            setShowChurchNameModal(false);
                        }
                    }}>
                        <div className="form-group">
                            <label htmlFor="churchName">교회 이름</label>
                            <input id="churchName" name="churchName" defaultValue={churchName} required autoFocus />
                        </div>
                        <button type="submit" className="submit-btn full-width">저장</button>
                    </form>
                </div>
            </div>
        )}
        
        {/* Reset Button at the bottom left */}
        <button 
            onClick={handleResetAll} 
            title="모든 데이터 초기화 (복구 불가)"
            style={{ 
                position: 'fixed', 
                bottom: '15px', 
                left: '15px', 
                zIndex: 900,
                padding: '5px 10px',
                fontSize: '0.75rem',
                backgroundColor: '#f1f1f1',
                color: '#888',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                opacity: 0.6,
                transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.opacity = '1';
                e.currentTarget.style.backgroundColor = '#ffebee';
                e.currentTarget.style.color = '#d32f2f';
                e.currentTarget.style.borderColor = '#d32f2f';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.opacity = '0.6';
                e.currentTarget.style.backgroundColor = '#f1f1f1';
                e.currentTarget.style.color = '#888';
                e.currentTarget.style.borderColor = '#ddd';
            }}
        >
            초기화
        </button>
      </main>
    </>
  );
};

// --- 컴포넌트들 ---

const ExcelExportModal: React.FC<{
    onClose: () => void;
    transactions: Transaction[];
    members: Member[];
    availableYears: number[];
    churchName: string;
}> = ({ onClose, transactions, members, availableYears, churchName }) => {
    const [mode, setMode] = useState<'total' | 'yearly' | 'monthly' | 'weekly'>('total');
    const [selYear, setSelYear] = useState(new Date().getFullYear());
    const [selMonths, setSelMonths] = useState<number[]>([]);
    const [selWeeks, setSelWeeks] = useState<string[]>([]);

    // 주간 목록 생성 (데이터가 있는 주차만)
    const availableWeeks = useMemo(() => {
        const weeks = new Set<string>();
        transactions.forEach(tx => {
            const d = new Date(tx.date);
            d.setDate(d.getDate() - d.getDay()); // 해당 주의 일요일로 맞춤
            weeks.add(d.toISOString().slice(0, 10));
        });
        return Array.from(weeks).sort((a, b) => b.localeCompare(a));
    }, [transactions]);

    const handleMonthToggle = (m: number) => {
        setSelMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleWeekToggle = (w: string) => {
        setSelWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);
    };

    const handleExport = () => {
        let filtered = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
        
        if (mode === 'yearly') {
            filtered = filtered.filter(tx => new Date(tx.date).getFullYear() === selYear);
        } else if (mode === 'monthly') {
            if (selMonths.length === 0) { alert('최소 한 달 이상 선택해주세요.'); return; }
            filtered = filtered.filter(tx => {
                const d = new Date(tx.date);
                return d.getFullYear() === selYear && selMonths.includes(d.getMonth() + 1);
            });
        } else if (mode === 'weekly') {
            if (selWeeks.length === 0) { alert('최소 한 주 이상 선택해주세요.'); return; }
            filtered = filtered.filter(tx => {
                const d = new Date(tx.date);
                d.setDate(d.getDate() - d.getDay());
                return selWeeks.includes(d.toISOString().slice(0, 10));
            });
        }

        if (filtered.length === 0) {
            alert('선택한 기간에 해당하는 데이터가 없습니다.');
            return;
        }

        // 엑셀 데이터용 JSON 생성 (잔액 계산 포함)
        let runningBalance = 0;
        const excelData = filtered.map(tx => {
            const member = members.find(m => m.id === tx.memberId);
            const income = tx.type === 'income' ? tx.amount : 0;
            const expense = tx.type === 'expense' ? tx.amount : 0;
            runningBalance += (income - expense);
            
            return {
                '날짜': tx.date,
                '요일': getDayOfWeek(tx.date),
                '성도명': member?.name || (tx.type === 'income' ? '무명' : '-'),
                '직분': member?.position || '-',
                '항목': renderCategory(tx.category),
                '입금액': income,
                '출금액': expense,
                '비고': tx.memo || '',
                '잔액': runningBalance
            };
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "헌금내역");
        
        const fileName = `${churchName}_${mode}_${todayString()}.xlsx`;
        XLSX.writeFile(wb, fileName);
        onClose();
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content large" style={{ maxWidth: '600px' }}>
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>엑셀 데이터 내보내기</h2>
                
                <div className="excel-export-options">
                    <div className="export-mode-tabs tabs">
                        <button className={`tab-button ${mode === 'total' ? 'active' : ''}`} onClick={() => setMode('total')}>전체</button>
                        <button className={`tab-button ${mode === 'yearly' ? 'active' : ''}`} onClick={() => setMode('yearly')}>년간</button>
                        <button className={`tab-button ${mode === 'monthly' ? 'active' : ''}`} onClick={() => setMode('monthly')}>월간</button>
                        <button className={`tab-button ${mode === 'weekly' ? 'active' : ''}`} onClick={() => setMode('weekly')}>주간</button>
                    </div>

                    <div className="export-detail-settings" style={{ padding: '1.5rem 0', minHeight: '200px' }}>
                        {(mode === 'yearly' || mode === 'monthly') && (
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label>년도 선택:</label>
                                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
                                    {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
                                </select>
                            </div>
                        )}

                        {mode === 'monthly' && (
                            <div className="multi-select-grid">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>월 선택 (복수 가능):</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <label key={m} className={`check-item-label ${selMonths.includes(m) ? 'checked' : ''}`}>
                                            <input type="checkbox" checked={selMonths.includes(m)} onChange={() => handleMonthToggle(m)} />
                                            {m}월
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === 'weekly' && (
                            <div className="multi-select-list">
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>주차 선택 (복수 가능):</label>
                                <div className="scroll-select-box" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '0.5rem' }}>
                                    {availableWeeks.map(w => (
                                        <label key={w} className={`check-item-label list-style ${selWeeks.includes(w) ? 'checked' : ''}`} style={{ display: 'flex', padding: '0.6rem', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={selWeeks.includes(w)} onChange={() => handleWeekToggle(w)} style={{ marginRight: '0.8rem' }} />
                                            {w} 시작 주 (일요일)
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {mode === 'total' && (
                            <p style={{ textAlign: 'center', color: '#666', fontSize: '1.1rem', paddingTop: '2rem' }}>저장된 모든 거래 내역을 엑셀로 생성합니다.</p>
                        )}
                    </div>
                </div>

                <div className="form-actions" style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
                    <button onClick={onClose} className="cancel-btn">취소</button>
                    <button onClick={handleExport} className="submit-btn excel-btn" style={{ backgroundColor: '#2e7d32' }}>엑셀 다운로드</button>
                </div>
            </div>
        </div>
    );
};

const CategorySummaryModal: React.FC<{
    title: string;
    activeTab: 'income' | 'expense';
    weeklyData: Record<string, number>;
    yearlyData: Record<string, number>;
    selectedYear: number;
    onYearChange: (year: number) => void;
    availableYears: number[];
    categories: string[];
    onClose: () => void;
}> = ({ title, activeTab, weeklyData, yearlyData, selectedYear, onYearChange, availableYears, categories, onClose }) => {
    const isIncome = activeTab === 'income';
    return (
        <div className="modal-backdrop">
            <div className="modal-content large" style={{ maxWidth: '1000px' }}>
                <button onClick={onClose} className="close-btn">&times;</button>
                
                <div className="summary-header-with-year" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem' }}>
                    <h2 style={{ margin: 0, border: 'none', color: isIncome ? '#1976d2' : '#d32f2f' }}>{title}</h2>
                    <div className="year-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <label htmlFor="modal-year-select" style={{ fontSize: '1.1rem', color: '#666', fontWeight: '500' }}>조회 년도:</label>
                        <select 
                            id="modal-year-select" 
                            value={selectedYear} 
                            onChange={(e) => onYearChange(Number(e.target.value))}
                            style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #dcdcdc', fontSize: '1.1rem', cursor: 'pointer' }}
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}년</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', overflowY: 'auto', maxHeight: '70vh', padding: '0.5rem' }}>
                    <div style={{ writingMode: 'vertical-rl', textOrientation: 'upright', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: isIncome ? '#2962ff' : '#d50000', borderRight: '3px solid #f0f0f0', paddingRight: '1.5rem', letterSpacing: '0.5rem' }}>
                        항목
                    </div>
                    <div className="row-values" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem', flexGrow: 1, display: 'grid', padding: '0' }}>
                        {categories.map(category => {
                            const weeklyVal = weeklyData[category] || 0;
                            const yearlyVal = yearlyData[category] || 0;
                            
                            if (!isIncome && weeklyVal === 0 && yearlyVal === 0) return null;

                            return (
                                <div className="value-item" key={category} style={{ padding: '1.25rem', borderRadius: '15px', backgroundColor: '#ffffff', border: '1px solid #eef2f6', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <span className="value-label" style={{ fontWeight: 'bold', color: '#333', fontSize: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f0f0f0' }}>
                                        {category}
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: '#888', fontWeight: '500' }}>금액 이번주</span>
                                            <span className="value-amount" style={{ color: isIncome ? '#2962ff' : '#d50000', fontSize: '1.35rem', fontWeight: '800' }}>
                                                {weeklyVal.toLocaleString()}원
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '1rem', color: '#888', fontWeight: '500' }}>{selectedYear}년 총금액</span>
                                            <span style={{ fontSize: '1.2rem', color: '#444', fontWeight: '700' }}>
                                                {yearlyVal.toLocaleString()}원
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                    <button onClick={onClose} style={{ padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', backgroundColor: '#f0f0f0', color: '#333', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>닫기</button>
                </div>
            </div>
        </div>
    );
};

const PeriodicalSummary: React.FC<{
  weeklyIncome: number;
  weeklyExpense: number;
  yearlyIncome: number;
  yearlyExpense: number;
  weeklyBalance: number;
  yearlyBalance: number;
}> = ({ weeklyIncome, weeklyExpense, yearlyIncome, yearlyExpense, weeklyBalance, yearlyBalance }) => (
  <section className="card periodical-summary">
    <div className="summary-row">
      <span className="row-label income-color">수입</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyIncome.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyIncome.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label expense-color">지출</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyExpense.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyExpense.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label">잔액</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 잔액</span>
          <span className="value-amount">{weeklyBalance.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 잔액</span>
          <span className="value-amount">{yearlyBalance.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </section>
);

const BalanceSummary: React.FC<{previousBalance: number, todaysChange: number, todaysBalance: number}> = ({ previousBalance, todaysChange, todaysBalance }) => (
  <section className="balance-summary">
    <div className="summary-item">
      <span className="summary-label">이전 잔액</span>
      <span className="summary-value">{previousBalance.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">오늘 변동금액</span>
      <span className={`summary-value ${todaysChange >= 0 ? 'income-color' : 'expense-color'}`}>{todaysChange.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">금일 잔액</span>
      <span className="summary-value bold" style={{ color: '#d50000' }}>{todaysBalance.toLocaleString()}원</span>
    </div>
  </section>
);

const IncomeForm: React.FC<{
    members: Member[], 
    categories: string[],
    festivals: string[],
    otherCategories: string[],
    onAddCategory: (cat: string) => void,
    onAddFestival: (cat: string) => void,
    onAddOtherCategory: (cat: string) => void,
    onAddTransaction: (tx: Omit<Transaction, 'id'>) => void,
    onManageCategories: () => void,
    onManageFestivals: () => void,
    onManageOtherCategories: () => void
}> = ({ members, categories, festivals, otherCategories, onAddCategory, onAddFestival, onAddOtherCategory, onAddTransaction, onManageCategories, onManageFestivals, onManageOtherCategories }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(categories[0] || '');
  const [festival, setFestival] = useState(festivals[0] || '');
  const [otherCategory, setOtherCategory] = useState(otherCategories[0] || '');
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memberConsonantFilter, setMemberConsonantFilter] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
        setCategory(categories[0]);
    }
  }, [categories, category]);

  const handleAddCategory = () => {
    const newCategory = prompt('추가할 입금 항목 이름을 입력하세요:');
    if (newCategory) onAddCategory(newCategory.trim());
  };

  const handleAddFestival = () => {
    const newCategory = prompt('추가할 절기 항목 이름을 입력하세요:');
    if (newCategory) onAddFestival(newCategory.trim());
  };

  const handleAddOther = () => {
    const newCategory = prompt('추가할 기타헌금 세부 항목 이름을 입력하세요:');
    if (newCategory) onAddOtherCategory(newCategory.trim());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || Number(amount) <= 0 || memberId === '' || !category) {
      alert('항목과 금액, 성도를 모두 선택해주세요.');
      return;
    }
    
    let finalCategory = category;
    if (category === '절기헌금') {
      if (!festival) { alert('세부 절기 항목을 선택해주세요.'); return; }
      finalCategory = `절기헌금 (세부) (${festival})`;
    } else if (category === '기타헌금') {
      if (!otherCategory) { alert('기타헌금 세부 항목을 선택해주세요.'); return; }
      finalCategory = `기타헌금 (세부) (${otherCategory})`;
    }

    onAddTransaction({ type: 'income', date, category: finalCategory, amount: Number(amount), memberId: Number(memberId) });
    setMemberId('');
    setAmount('');
    // 성공 시 선택 초기화
    setMemberConsonantFilter(null);
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="income-date" className="label-with-day">
          <span>입금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="income-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="income-category">입금 내역</label>
        <div className="category-input">
            <select id="income-category" value={category} onChange={e => setCategory(e.target.value)} required>
                <option value="" disabled>-- 항목 선택 --</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={handleAddCategory} className="add-category-btn" title="새 항목 추가">+</button>
            <button type="button" onClick={onManageCategories} className="manage-category-btn" title="항목 관리">⚙️</button>
        </div>
      </div>
      {category === '절기헌금' && (
        <div className="form-group">
            <label htmlFor="income-festival">절기 세부 항목</label>
            <div className="category-input">
                <select id="income-festival" value={festival} onChange={e => setFestival(e.target.value)} required>
                    <option value="" disabled>-- 절기 선택 --</option>
                    {festivals.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <button type="button" onClick={handleAddFestival} className="add-category-btn" title="새 절기 추가">+</button>
                <button type="button" onClick={onManageFestivals} className="manage-category-btn" title="절기 관리">⚙️</button>
            </div>
        </div>
      )}
      {category === '기타헌금' && (
        <div className="form-group">
            <label htmlFor="income-other">기타헌금 세부 항목</label>
            <div className="category-input">
                <select id="income-other" value={otherCategory} onChange={e => setOtherCategory(e.target.value)} required>
                    <option value="" disabled>-- 항목 선택 --</option>
                    {otherCategories.map(oc => <option key={oc} value={oc}>{oc}</option>)}
                </select>
                <button type="button" onClick={handleAddOther} className="add-category-btn" title="새 세부 항목 추가">+</button>
                <button type="button" onClick={onManageOtherCategories} className="manage-category-btn" title="세부 항목 관리">⚙️</button>
            </div>
        </div>
      )}
      
      {/* 헌금자 선택 영역 (개선된 퀵 픽커 적용) */}
      <MemberQuickPicker
        label="헌금자 선택"
        members={members}
        selectedId={memberId}
        onSelect={setMemberId}
        consonantFilter={memberConsonantFilter}
        onConsonantSelect={setMemberConsonantFilter}
      />

      <div className="form-group amount-row-group">
        <label htmlFor="income-amount">금액 (원)</label>
        <input 
            id="income-amount" 
            type="number" 
            placeholder="숫자만 입력" 
            value={amount} 
            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
            required 
            min="1" 
        />
        <QuickAmountSelector currentAmount={amount} onChange={setAmount} />
      </div>
      <button type="submit" className="submit-btn" style={{ gridColumn: '1 / -1', justifySelf: 'end' }}>등록 완료</button>
    </form>
  );
};

const ExpenseForm: React.FC<{
    members: Member[], 
    categories: string[], 
    subCategories: Record<string, string[]>,
    onAddCategory: (cat: string) => void, 
    onAddSubCategory: (main: string, sub: string) => void,
    onAddTransaction: (tx: Omit<Transaction, 'id'>) => void,
    onManageCategories: () => void,
    onManageSubCategories: (main: string) => void
}> = ({ members, categories, subCategories, onAddCategory, onAddSubCategory, onAddTransaction, onManageCategories, onManageSubCategories }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(categories[0] || '');
  const [subCategory, setSubCategory] = useState('');
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  const [memberConsonantFilter, setMemberConsonantFilter] = useState<string | null>(null);

  const currentSubList = subCategories[category] || [];

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
        setCategory(categories[0]);
    }
    setSubCategory(subCategories[category]?.[0] || '');
  }, [category, categories, subCategories]);

  const handleAddCategory = () => {
    const newCategory = prompt('추가할 출금 항목 이름을 입력하세요:');
    if (newCategory) onAddCategory(newCategory.trim());
  };

  const handleAddSub = () => {
      const newSub = prompt(`'${category}'의 세부 항목 이름을 입력하세요:`);
      if (newSub) onAddSubCategory(category, newSub.trim());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || amount <= 0 || !category) {
      alert('출금 내역과 금액을 정확히 입력해주세요.');
      return;
    }

    let finalCategory = category;
    if (subCategory) {
        finalCategory = `${category} (세부) (${subCategory})`;
    }

    onAddTransaction({ type: 'expense', date, category: finalCategory, amount: Number(amount), memberId: memberId === '' ? undefined : Number(memberId), memo });
    setMemberId('');
    setAmount('');
    setMemo('');
    setMemberConsonantFilter(null);
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="expense-date" className="label-with-day">
          <span>출금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="expense-category">출금 내역</label>
        <div className="category-input">
          <select id="expense-category" value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="" disabled>-- 항목 선택 --</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={handleAddCategory} className="add-category-btn" title="새 항목 추가">+</button>
          <button type="button" onClick={onManageCategories} className="manage-category-btn" title="항목 관리">⚙️</button>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="expense-sub-category">세부 항목 (선택)</label>
        <div className="category-input">
            <select id="expense-sub-category" value={subCategory} onChange={e => setSubCategory(e.target.value)}>
                <option value="">-- 세부 항목 없음 --</option>
                {currentSubList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={handleAddSub} className="add-category-btn" title="새 세부 항목 추가">+</button>
            <button type="button" onClick={() => onManageSubCategories(category)} className="manage-category-btn" title="세부 항목 관리">⚙️</button>
        </div>
      </div>

      {/* 사용자 선택 영역 (개선된 퀵 픽커 적용) */}
      <MemberQuickPicker
        label="사용자 선택 (선택 사항)"
        members={members}
        selectedId={memberId}
        onSelect={setMemberId}
        consonantFilter={memberConsonantFilter}
        onConsonantSelect={setMemberConsonantFilter}
      />

      <div className="form-group amount-row-group">
        <label htmlFor="expense-amount">금액 (원)</label>
        <input 
            id="expense-amount" 
            type="number" 
            placeholder="숫자만 입력" 
            value={amount} 
            onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
            required 
            min="1" 
        />
        <QuickAmountSelector currentAmount={amount} onChange={setAmount} />
      </div>
      <div className="form-group">
        <label htmlFor="expense-memo">비고</label>
        <input id="expense-memo" type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택사항)" />
      </div>
      <button type="submit" className="submit-btn" style={{ gridColumn: '1 / -1', justifySelf: 'end' }}>등록</button>
    </form>
  );
};

const TransactionList: React.FC<{
  transactions: (Transaction & {balance: number})[], 
  getMemberName: (id?: number) => string,
  onSaveData: () => void,
  onLoadData: (event: ChangeEvent<HTMLInputElement>) => void,
  onLoadMembersOnly: (event: ChangeEvent<HTMLInputElement>) => void,
  onEdit: (tx: Transaction) => void,
  onDelete: (id: number) => void
}> = ({ transactions, getMemberName, onSaveData, onLoadData, onLoadMembersOnly, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;
    const PAGES_PER_GROUP = 10; // 변경: 10페이지씩 표시

    useEffect(() => {
        setCurrentPage(1);
    }, [transactions]);

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const startPage = Math.floor((currentPage - 1) / PAGES_PER_GROUP) * PAGES_PER_GROUP + 1;
    const endPage = Math.min(startPage + PAGES_PER_GROUP - 1, totalPages);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };
    
    return (
        <section className="card">
            <h2>거래 내역</h2>
            <div className="transaction-list">
                <div className="transaction-header">
                    <span>날짜</span>
                    <span>입금</span>
                    <span>출금</span>
                    <span>금액</span>
                    <span>잔액</span>
                    <span>작업</span>
                </div>
                {transactions.length === 0 ? (
                    <p className="empty-list">거래 내역이 없습니다.</p>
                ) : (
                    paginatedTransactions.map(({ balance, ...tx }) => (
                        <div key={tx.id} className={`transaction-item ${tx.type}`}>
                            <span>{tx.date}</span>
                            <span>{tx.type === 'income' ? <>{getMemberName(tx.memberId)} ({renderCategory(tx.category)})</> : '-'}</span>
                            <span>{tx.type === 'expense' ? <>{renderCategory(tx.category)}{tx.memo ? ` (${tx.memo})` : ''}</> : '-'}</span>
                            <span className={tx.type === 'income' ? 'income-color' : 'expense-color'}>{tx.amount.toLocaleString()}원</span>
                            <span>{balance.toLocaleString()}원</span>
                            <div className="transaction-actions">
                                <button onClick={() => onEdit(tx)} className="action-btn edit">수정</button>
                                <button onClick={() => onDelete(tx.id)} className="action-btn delete">삭제</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button 
                        onClick={() => handlePageChange(1)} 
                        disabled={currentPage === 1}
                        title="처음으로"
                    >«</button>
                    <button 
                        onClick={() => handlePageChange(startPage - 1)} 
                        disabled={startPage === 1}
                        title="이전 그룹"
                    >‹</button>
                    {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
                        <button key={page} onClick={() => handlePageChange(page)} className={currentPage === page ? 'active' : ''}>{page}</button>
                    ))}
                    <button 
                        onClick={() => handlePageChange(endPage + 1)} 
                        disabled={endPage === totalPages}
                        title="다음 그룹"
                    >›</button>
                    <button 
                        onClick={() => handlePageChange(totalPages)} 
                        disabled={currentPage === totalPages}
                        title="끝으로"
                    >»</button>
                </div>
            )}
            <div className="data-management">
                <button onClick={onSaveData} className="data-btn">데이터 저장</button>
                <label htmlFor="load-data-input" className="data-btn">데이터 불러오기</label>
                <input id="load-data-input" type="file" accept=".json" onChange={onLoadData} style={{ display: 'none' }} />
                <label htmlFor="load-members-only-input" className="data-btn members-only-btn">성도만 불러오기</label>
                <input id="load-members-only-input" type="file" accept=".json" onChange={onLoadMembersOnly} style={{ display: 'none' }} />
            </div>
        </section>
    );
};

const AddMemberModal: React.FC<{onAddMember: (name: string, position: string) => void, onClose: () => void}> = ({ onAddMember, onClose }) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState(POSITIONS[0]);
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddMember(name, position);
  };
  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>새 성도 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-member-name">이름</label>
            <input id="new-member-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="new-member-position">직분</label>
            <select id="new-member-position" value={position} onChange={e => setPosition(e.target.value)}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="submit-btn">추가</button>
        </form>
      </div>
    </div>
  );
};

const EditMembersModal: React.FC<{
    members: Member[];
    onClose: () => void;
    onUpdateMember: (id: number, newName: string, newPosition: string) => void;
    onDeleteMember: (id: number) => void;
}> = ({ members, onClose, onUpdateMember, onDeleteMember }) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editPosition, setEditPosition] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredMembers = useMemo(() => {
        return members.filter(m => m.name.includes(searchQuery));
    }, [members, searchQuery]);

    const handleEditStart = (member: Member) => {
        setEditingId(member.id);
        setEditName(member.name);
        setEditPosition(member.position);
    };

    const handleEditSave = () => {
        if (editingId && editName.trim()) {
            onUpdateMember(editingId, editName.trim(), editPosition);
            setEditingId(null);
        } else alert('이름을 입력해주세요.');
    };

    const handleDelete = (member: Member) => {
        if (window.confirm(`${member.name} (${member.position}) 님을 삭제하시겠습니까?\n관련된 모든 거래 내역은 유지되지만, 이름이 '미지정'으로 표시됩니다.`)) {
            onDeleteMember(member.id);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content large" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2 style={{ marginBottom: '1rem' }}>성도 정보 수정</h2>
                
                <div className="modal-search-area" style={{ marginBottom: '1.5rem' }}>
                    <input 
                        type="text" 
                        placeholder="수정할 성도 이름 검색" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '2px solid var(--primary-color)', fontSize: '1rem' }}
                    />
                </div>

                <div className="edit-members-scroll-area" style={{ overflowY: 'auto', flexGrow: 1, paddingRight: '0.5rem' }}>
                    {KOREAN_CONSONANTS.map(consonant => {
                        const group = filteredMembers.filter(m => getInitialConsonant(m.name) === consonant);
                        if (group.length === 0) return null;
                        
                        return (
                            <div key={consonant} className="edit-member-group" style={{ marginBottom: '1.5rem' }}>
                                <h3 className="group-title" style={{ fontSize: '1.2rem', color: 'var(--primary-color)', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>{consonant}</h3>
                                <ul className="member-list" style={{ listStyle: 'none', padding: 0 }}>
                                    {group.map(member => (
                                        <li key={member.id} className="member-item" style={{ background: '#f9f9f9', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee' }}>
                                            {editingId === member.id ? (
                                                <div className="edit-form-full" style={{ width: '100%', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <input 
                                                        type="text" 
                                                        value={editName} 
                                                        onChange={(e) => setEditName(e.target.value)} 
                                                        style={{ flexGrow: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                                    />
                                                    <select 
                                                        value={editPosition} 
                                                        onChange={(e) => setEditPosition(e.target.value)}
                                                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                                                    >
                                                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <div className="member-actions" style={{ display: 'flex', gap: '0.3rem' }}>
                                                        <button onClick={handleEditSave} className="save-btn" style={{ padding: '0.5rem 0.8rem', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                                                        <button onClick={() => setEditingId(null)} className="cancel-btn" style={{ padding: '0.5rem 0.8rem', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="member-info" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{member.name}</span>
                                                        <small style={{ color: '#666' }}>{member.position}</small>
                                                    </div>
                                                    <div className="member-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button onClick={() => handleEditStart(member)} className="edit-btn" style={{ padding: '0.4rem 0.8rem', backgroundColor: '#e3f2fd', color: '#1976d2', border: '1px solid #bbdefb', borderRadius: '4px', cursor: 'pointer' }}>수정</button>
                                                        <button onClick={() => handleDelete(member)} className="delete-btn" style={{ padding: '0.4rem 0.8rem', backgroundColor: '#ffebee', color: '#d32f2f', border: '1px solid #ffcdd2', borderRadius: '4px', cursor: 'pointer' }}>삭제</button>
                                                    </div>
                                                </>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        );
                    })}
                    {filteredMembers.length === 0 && <p style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>검색 결과가 없습니다.</p>}
                </div>
            </div>
        </div>
    );
};

const ManageCategoriesModal: React.FC<{
    title: string;
    categories: string[];
    onClose: () => void;
    onUpdate: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
    onAdd: (name: string) => void;
}> = ({ title, categories, onClose, onUpdate, onDelete, onAdd }) => {
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newValue, setNewValue] = useState('');

    const startEdit = (cat: string) => {
        setEditingCategory(cat);
        setEditValue(cat);
    };

    const saveEdit = () => {
        if (editingCategory && editValue.trim() && editValue !== editingCategory) {
            onUpdate(editingCategory, editValue.trim());
        }
        setEditingCategory(null);
    };

    const handleAddNew = (e: React.FormEvent) => {
        e.preventDefault();
        if (newValue.trim()) {
            onAdd(newValue.trim());
            setNewValue('');
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>{title}</h2>
                
                {/* 항목 추가 영역 */}
                <form onSubmit={handleAddNew} className="modal-add-form" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                    <input 
                        type="text" 
                        placeholder="새 항목 이름 입력" 
                        value={newValue} 
                        onChange={e => setNewValue(e.target.value)}
                        style={{ flexGrow: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                    <button type="submit" className="save-btn" style={{ whiteSpace: 'nowrap' }}>추가</button>
                </form>

                <ul className="member-list" style={{ overflowY: 'auto', flexGrow: 1 }}>
                    {categories.map(cat => (
                        <li key={cat} className="member-item">
                            {editingCategory === cat ? (
                                <>
                                    <div className="edit-form" style={{ flexGrow: 1 }}>
                                        <input 
                                            type="text" 
                                            value={editValue} 
                                            onChange={e => setEditValue(e.target.value)} 
                                            autoFocus 
                                            style={{ width: '100%', padding: '0.4rem' }}
                                        />
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={saveEdit} className="save-btn">저장</button>
                                        <button onClick={() => setEditingCategory(null)} className="cancel-btn">취소</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span style={{ flexGrow: 1 }}>{cat}</span>
                                    <div className="member-actions">
                                        <button onClick={() => startEdit(cat)} className="edit-btn">수정</button>
                                        <button onClick={() => onDelete(cat)} className="delete-btn">삭제</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                    {categories.length === 0 && <p className="empty-list">항목이 없습니다.</p>}
                </ul>
            </div>
        </div>
    );
};

const EditTransactionModal: React.FC<{
    transaction: Transaction;
    onClose: () => void;
    onSave: (tx: Transaction) => void;
    members: Member[];
    incomeCategories: string[];
    expenseCategories: string[];
    expenseSubCategoriesMap: Record<string, string[]>;
    festivalCategories: string[];
    otherIncomeCategories: string[];
    onAddIncomeCategory: (cat: string) => void;
    onAddExpenseCategory: (cat: string) => void;
    onAddExpenseSubCategory: (main: string, sub: string) => void;
    onAddFestivalCategory: (cat: string) => void;
    onAddOtherIncomeCategory: (cat: string) => void;
}> = ({ transaction, onClose, onSave, members, incomeCategories, expenseCategories, expenseSubCategoriesMap, festivalCategories, otherIncomeCategories, onAddIncomeCategory, onAddExpenseCategory, onAddExpenseSubCategory, onAddFestivalCategory, onAddOtherIncomeCategory }) => {
    const [formData, setFormData] = useState<Transaction>(transaction);
    const [mainCategory, setMainCategory] = useState('');
    const [subItem, setSubItem] = useState('');
    const [memberConsonantFilter, setMemberConsonantFilter] = useState<string | null>(null);

    useEffect(() => {
        setFormData(transaction);
        const match = transaction.category.match(/^(.*) \(세부\) \((.*)\)$/);
        if (match) {
            setMainCategory(match[1]);
            setSubItem(match[2]);
        } else {
            setMainCategory(transaction.category);
            setSubItem('');
        }
        // 수정 시에도 초기 필터를 성도 이름의 초성으로 설정해주면 편리함
        if (transaction.memberId) {
            const m = members.find(m => m.id === transaction.memberId);
            if (m) setMemberConsonantFilter(getInitialConsonant(m.name));
        }
    }, [transaction, members]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let processedValue: string | number | undefined = value;
        if (name === 'amount') processedValue = value === '' ? 0 : Number(value);
        else if (name === 'memberId') processedValue = value === '' ? undefined : Number(value);
        setFormData(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleMainCategoryChange = (val: string) => {
      setMainCategory(val);
      if (val === '절기헌금' || val === '기타헌금' || formData.type === 'expense') {
        const subs = (val === '절기헌금' ? festivalCategories : (val === '기타헌금' ? otherIncomeCategories : (expenseSubCategoriesMap[val] || [])));
        const firstSub = subs[0] || '';
        setSubItem(firstSub);
        if (firstSub) {
            setFormData(prev => ({ ...prev, category: `${val} (세부) (${firstSub})` }));
        } else {
            setFormData(prev => ({ ...prev, category: val }));
        }
      } else {
        setFormData(prev => ({ ...prev, category: val }));
      }
    };

    const handleSubItemChange = (val: string) => {
      setSubItem(val);
      if (val) {
          setFormData(prev => ({ ...prev, category: `${mainCategory} (세부) (${val})` }));
      } else {
          setFormData(prev => ({ ...prev, category: mainCategory }));
      }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (formData.amount <= 0) { alert('금액은 0보다 커야 합니다.'); return; }
        if (formData.type === 'income' && !formData.memberId) { alert('헌금자를 선택해주세요.'); return; }
        onSave(formData);
    };

    const handleAddMain = () => {
        const newCat = prompt('추가할 항목 이름을 입력하세요:');
        if (newCat) {
            if (formData.type === 'income') onAddIncomeCategory(newCat.trim());
            else onAddExpenseCategory(newCat.trim());
        }
    };

    const handleAddSub = () => {
        const newSub = prompt(`'${mainCategory}'의 세부 항목 이름을 입력하세요:`);
        if (newSub) {
            if (mainCategory === '절기헌금') onAddFestivalCategory(newSub.trim());
            else if (mainCategory === '기타헌금') onAddOtherIncomeCategory(newSub.trim());
            else onAddExpenseSubCategory(mainCategory, newSub.trim());
        }
    };

    const currentSubs = (mainCategory === '절기헌금' ? festivalCategories : (mainCategory === '기타헌금' ? otherIncomeCategories : (expenseSubCategoriesMap[mainCategory] || [])));

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>거래 내역 수정</h2>
                <form onSubmit={handleSubmit} className="transaction-form">
                    <div className="form-group">
                        <label htmlFor="edit-date" className="label-with-day">
                            <span>날짜</span>
                            <span>{getDayOfWeek(formData.date)}</span>
                        </label>
                        <input id="edit-date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-amount">금액 (원)</label>
                        <input id="edit-amount" name="amount" type="number" value={formData.amount} onChange={handleChange} required min="1" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="edit-main-category">{formData.type === 'income' ? '입금 내역' : '출금 내역'}</label>
                        <div className="category-input">
                            <select id="edit-main-category" value={mainCategory} onChange={e => handleMainCategoryChange(e.target.value)}>
                                {(formData.type === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button type="button" onClick={handleAddMain} className="add-category-btn">+</button>
                        </div>
                    </div>
                    {(mainCategory === '절기헌금' || mainCategory === '기타헌금' || formData.type === 'expense') && (
                        <div className="form-group">
                            <label>세부 항목</label>
                            <div className="category-input">
                                <select value={subItem} onChange={e => handleSubItemChange(e.target.value)}>
                                    <option value="">-- 세부 항목 없음 --</option>
                                    {currentSubs.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button type="button" onClick={handleAddSub} className="add-category-btn">+</button>
                            </div>
                        </div>
                    )}
                    
                    <MemberQuickPicker
                      label={formData.type === 'income' ? "헌금자 수정" : "사용자 수정"}
                      members={members}
                      selectedId={formData.memberId || ''}
                      onSelect={(id) => setFormData(prev => ({ ...prev, memberId: id }))}
                      consonantFilter={memberConsonantFilter}
                      onConsonantSelect={setMemberConsonantFilter}
                    />

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="edit-expense-memo">비고</label>
                        <input id="edit-expense-memo" name="memo" type="text" value={formData.memo || ''} onChange={handleChange} placeholder="메모 (선택사항)" />
                    </div>
                    
                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn form-btn">취소</button>
                        <button type="submit" className="submit-btn form-btn">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SnapshotsModal: React.FC<{
    snapshots: DataSnapshot[];
    onClose: () => void;
    onLoad: (snapshotData: DataSnapshot['data']) => void;
    onDelete: (timestamp: string) => void;
}> = ({ snapshots, onClose, onLoad, onDelete }) => (
    <div className="modal-backdrop">
        <div className="modal-content large">
            <button onClick={onClose} className="close-btn">&times;</button>
            <h2>저장된 데이터 목록</h2>
            {snapshots.length === 0 ? <p className="empty-list">저장된 데이터가 없습니다.</p> : (
                <ul className="snapshot-list">
                    {snapshots.map(snapshot => (
                        <li key={snapshot.timestamp} className="snapshot-item">
                            <div className="snapshot-info">
                                <span>{new Date(snapshot.timestamp).toLocaleString('ko-KR')}</span>
                                <small>성도: {snapshot.data.members.length}명, 거래: {snapshot.data.transactions.length}건</small>
                            </div>
                            <div className="snapshot-actions">
                                <button onClick={() => onLoad(snapshot.data)} className="load-btn">불러오기</button>
                                <button onClick={() => onDelete(snapshot.timestamp)} className="delete-btn">삭제</button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
);

const SearchModal: React.FC<{
    transactions: Transaction[], 
    members: Member[], 
    getMemberName: (id?: number) => string,
    incomeCategories: string[],
    expenseCategories: string[],
    onClose: () => void
}> = ({ transactions, members, getMemberName, incomeCategories, expenseCategories, onClose }) => {
    const [searchType, setSearchType] = useState<'name' | 'category' | 'amount'>('name');
    const [nameQuery, setNameQuery] = useState<number | ''>('');
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income');
    const [categoryQuery, setCategoryQuery] = useState('');
    const [amountQuery, setAmountQuery] = useState<number | ''>('');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(todayString);
    const filteredTransactions = useMemo(() => transactions.filter(tx => tx.date >= startDate && tx.date <= endDate), [transactions, startDate, endDate]);
    const todaysTotals = useMemo(() => {
        const today = todayString();
        const todaysTransactions = transactions.filter(tx => tx.date === today);
        const totalIncome = todaysTransactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
        const totalExpense = todaysTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
        return { totalIncome, totalExpense };
    }, [transactions]);
    const nameSearchResult = useMemo(() => {
        if (searchType !== 'name' || nameQuery === '') return null;
        const result = filteredTransactions.filter(tx => tx.memberId === nameQuery && tx.type === 'income');
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, nameQuery]);

    const categorySearchResult = useMemo(() => {
        if (searchType !== 'category' || categoryQuery === '') return null;
        
        const matchingTransactions = filteredTransactions.filter(tx => {
            if (tx.type !== categoryType) return false;
            if (categoryQuery === 'ALL') return true;
            return tx.category === categoryQuery || tx.category.startsWith(categoryQuery + ' (세부) (');
        });

        const grandTotal = matchingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

        let breakdown: { category: string, total: number }[] = [];
        if (categoryQuery === 'ALL') {
            const categoriesToUse = categoryType === 'income' ? incomeCategories : expenseCategories;
            breakdown = categoriesToUse.map(cat => ({
                category: cat,
                total: matchingTransactions.filter(tx => tx.category === cat || tx.category.startsWith(cat + ' (세부) (')).reduce((sum, tx) => sum + tx.amount, 0)
            })).filter(item => item.total > 0 || categoryType === 'income');
        }

        return { transactions: matchingTransactions, total: grandTotal, breakdown };
    }, [filteredTransactions, searchType, categoryType, categoryQuery, incomeCategories, expenseCategories]);

    const amountSearchResult = useMemo(() => {
        if (searchType !== 'amount' || amountQuery === '' || amountQuery === 0) return null;
        const result = filteredTransactions.filter(tx => tx.amount === Number(amountQuery));
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, amountQuery]);
    
    const handleCategoryAll = (type: 'income' | 'expense') => {
        setCategoryType(type);
        setCategoryQuery('ALL');
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>조회</h2>
                <div className="search-controls">
                    <div className="form-group date-range">
                        <label>기간 설정:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span>~</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="tabs">
                        <button className={`tab-button ${searchType === 'name' ? 'active' : ''}`} onClick={() => setSearchType('name')}>이름 조회</button>
                        <button className={`tab-button ${searchType === 'category' ? 'active' : ''}`} onClick={() => setSearchType('category')}>항목별 조회</button>
                        <button className={`tab-button ${searchType === 'amount' ? 'active' : ''}`} onClick={() => setSearchType('amount')}>특정금액조회</button>
                    </div>
                    {searchType === 'name' && (
                        <div className="form-group">
                            <label>이름:</label>
                            <select value={nameQuery} onChange={e => setNameQuery(Number(e.target.value))}>
                                <option value="" disabled>-- 성도 선택 --</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    )}
                    {searchType === 'category' && (
                        <div className="category-search-container">
                            <div className="category-search-group" style={{ flexWrap: 'wrap' }}>
                                <select value={categoryType} onChange={e => { setCategoryType(e.target.value as 'income' | 'expense'); setCategoryQuery(''); }}>
                                    <option value="income">입금</option>
                                    <option value="expense">출금</option>
                                </select>
                                <select value={categoryQuery === 'ALL' ? '' : categoryQuery} onChange={e => setCategoryQuery(e.target.value)}>
                                    <option value="" disabled>-- 항목 선택 --</option>
                                    {(categoryType === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <div className="all-view-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className={`action-btn edit ${categoryType === 'income' && categoryQuery === 'ALL' ? 'active' : ''}`} onClick={() => handleCategoryAll('income')} style={{ padding: '0.6rem 1rem' }}>입금전체</button>
                                    <button type="button" className={`action-btn delete ${categoryType === 'expense' && categoryQuery === 'ALL' ? 'active' : ''}`} onClick={() => handleCategoryAll('expense')} style={{ padding: '0.6rem 1rem' }}>출금전체</button>
                                </div>
                            </div>
                            <div className="today-totals-summary">
                                <div><span>오늘의 입금 총액</span><span className="income-color">{todaysTotals.totalIncome.toLocaleString()}원</span></div>
                                <div><span>오늘의 출금 총액</span><span className="expense-color">{todaysTotals.totalExpense.toLocaleString()}원</span></div>
                            </div>
                        </div>
                    )}
                    {searchType === 'amount' && (
                        <div className="form-group">
                            <label>금액:</label>
                            <input type="number" placeholder="금액을 입력하세요" value={amountQuery} onChange={e => setAmountQuery(e.target.value === '' ? '' : Number(e.target.value))} />
                        </div>
                    )}
                </div>
                <div className="search-results">
                    {nameSearchResult && (
                        <><h3>{getMemberName(nameQuery)}님 헌금 내역 (총: {nameSearchResult.total.toLocaleString()}원)</h3>
                        <ul>{nameSearchResult.transactions.map(tx => <li key={tx.id}>{tx.date} | {renderCategory(tx.category)}: {tx.amount.toLocaleString()}원</li>)}</ul></>
                    )}
                    {categorySearchResult && (
                        <>
                            <h3>{categoryQuery === 'ALL' ? (categoryType === 'income' ? '입금 전체 합산' : '출금 전체 합산') : `${categoryQuery} 내역`} (총: {categorySearchResult.total.toLocaleString()}원)</h3>
                            {categoryQuery === 'ALL' ? (
                                <ul className="category-summary-list">
                                    {categorySearchResult.breakdown.map(item => (
                                        <li key={item.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 1rem', borderBottom: '1px solid #eee' }}>
                                            <span style={{ fontWeight: '500' }}>{renderCategory(item.category)}</span>
                                            <span style={{ color: categoryType === 'income' ? 'var(--income-color)' : 'var(--expense-color)', fontWeight: 'bold' }}>{item.total.toLocaleString()}원</span>
                                        </li>
                                    ))}
                                    <li style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8f9fa', marginTop: '0.5rem', borderRadius: '8px' }}>
                                        <span style={{ fontWeight: 'bold' }}>합계</span>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#d50000' }}>{categorySearchResult.total.toLocaleString()}원</span>
                                    </li>
                                </ul>
                            ) : (
                                <ul>{categorySearchResult.transactions.map(tx => (
                                    <li key={tx.id}>{tx.date} | {tx.type === 'income' ? getMemberName(tx.memberId) : (tx.memo || '메모 없음')}: {tx.amount.toLocaleString()}원</li>
                                ))}</ul>
                            )}
                        </>
                    )}
                    {amountSearchResult && (
                        <><h3>{Number(amountQuery).toLocaleString()}원 내역 (총: {amountSearchResult.total.toLocaleString()}원)</h3>
                        <ul>{amountSearchResult.transactions.map(tx => (<li key={tx.id}>{tx.date} | <span className={tx.type === 'income' ? 'income-color' : 'expense-color'}>{tx.type === 'income' ? ' [입금]' : ' [출금]'}</span> {' '} {tx.type === 'income' ? <>{getMemberName(tx.memberId)} ({renderCategory(tx.category)})</> : <>{renderCategory(tx.category)}{tx.memo ? ` (${tx.memo})` : ''}</>} : {tx.amount.toLocaleString()}원</li>))}</ul></>
                    )}
                </div>
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);
