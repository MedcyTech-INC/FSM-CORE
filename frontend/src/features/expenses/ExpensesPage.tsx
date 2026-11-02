import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt,
  Plus,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  RefreshCw,
  Fuel,
  Utensils,
  Car,
  Building,
  Ticket,
  DollarSign,
  Tag,
  Check,
  X,
  RotateCcw,
  Landmark,
  CreditCard,
  FileText,
  Send,
} from 'lucide-react';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ExpenseClaim, ExpenseUploadReceiptResult } from '../../types/api';

const CATEGORIES = [
  { id: 'fuel', label: 'Fuel / Mileage', icon: Fuel, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'food_allowance', label: 'Food Allowance', icon: Utensils, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'travel_ticket', label: 'Travel Ticket', icon: Ticket, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'accommodation', label: 'Accommodation', icon: Building, color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { id: 'toll_parking', label: 'Toll & Parking', icon: Car, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { id: 'client_entertainment', label: 'Client Entertainment', icon: DollarSign, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'miscellaneous', label: 'Miscellaneous', icon: Tag, color: 'text-slate-600 bg-slate-50 border-slate-200' },
];

export const ExpensesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { latitude, longitude } = useGeolocation();

  // Role resolution
  const role = user?.role || 'MR';
  const isFinance = role === 'FINANCE';
  const isAdmin = role === 'ADMIN';
  const isManager = ['RSM', 'ZSM', 'GM'].includes(role);
  const isZsmOrAbove = ['ZSM', 'GM', 'ADMIN'].includes(role);
  const isRep = role === 'MR';

  const defaultView = isFinance ? 'finance-queue' : isRep ? 'my-claims' : 'team-audit';
  const [activeView, setActiveView] = useState<'new' | 'my-claims' | 'team-audit' | 'finance-queue'>(defaultView);

  const [myClaims, setMyClaims] = useState<ExpenseClaim[]>([]);
  const [teamClaims, setTeamClaims] = useState<ExpenseClaim[]>([]);
  const [financeClaims, setFinanceClaims] = useState<ExpenseClaim[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [category, setCategory] = useState<string>('fuel');
  const [amount, setAmount] = useState<string>('');
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [totalReceiptAmount, setTotalReceiptAmount] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');

  // Receipt capture & OCR state
  const [receiptResult, setReceiptResult] = useState<ExpenseUploadReceiptResult | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Review modal state (Managers)
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'SEND_BACK' | null>(null);

  // Resubmit modal state (Field Rep)
  const [resubmittingClaim, setResubmittingClaim] = useState<ExpenseClaim | null>(null);
  const [resubmitAmount, setResubmitAmount] = useState<string>('');
  const [resubmitDescription, setResubmitDescription] = useState<string>('');
  const [resubmitInvoiceNumber, setResubmitInvoiceNumber] = useState<string>('');
  const [resubmitReceipt, setResubmitReceipt] = useState<ExpenseUploadReceiptResult | null>(null);
  const [resubmitUploading, setResubmitUploading] = useState(false);
  const resubmitFileInputRef = useRef<HTMLInputElement | null>(null);

  // Disbursement modal state (Finance)
  const [disburseTargetClaim, setDisburseTargetClaim] = useState<ExpenseClaim | null>(null);
  const [paymentRefNumber, setPaymentRefNumber] = useState<string>('');
  const [financeNote, setFinanceNote] = useState<string>('');
  const [disbursing, setDisbursing] = useState(false);

  useEffect(() => {
    if (user?.role === 'FINANCE') {
      setActiveView('finance-queue');
    } else if (user?.role === 'MR') {
      setActiveView('my-claims');
    }
  }, [user?.role]);

  const loadData = async () => {
    setLoading(true);
    try {
      const promises: Promise<any>[] = [api.getMyExpenseClaims()];
      if (isAdmin || isManager) {
        promises.push(api.getTeamExpenseClaims());
      }
      if (isAdmin || isFinance) {
        promises.push(api.getFinanceExpenseClaims());
      }

      const results = await Promise.all(promises);
      setMyClaims(results[0] || []);
      if (isAdmin || isManager) setTeamClaims(results[1] || []);
      if (isAdmin || isFinance) {
        const finList = (isAdmin && isManager) ? results[2] : (isAdmin ? results[1] : results[1]);
        if (finList) setFinanceClaims(finList);
      }
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.role]);

  const handleCaptureReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptUploading(true);
    try {
      const clientIso = new Date().toISOString();
      const res = await api.uploadExpenseReceipt(file, clientIso, latitude || undefined, longitude || undefined);
      setReceiptResult(res);

      if (res.extracted_amount && !amount) {
        setAmount(res.extracted_amount.toString());
      }
      if (res.extracted_invoice_number && !invoiceNumber) {
        setInvoiceNumber(res.extracted_invoice_number);
      }
    } catch (err) {
      console.error('Receipt upload failed', err);
    } finally {
      setReceiptUploading(false);
    }
  };

  const handleCaptureResubmitReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResubmitUploading(true);
    try {
      const clientIso = new Date().toISOString();
      const res = await api.uploadExpenseReceipt(file, clientIso, latitude || undefined, longitude || undefined);
      setResubmitReceipt(res);
      if (res.extracted_amount && !resubmitAmount) {
        setResubmitAmount(res.extracted_amount.toString());
      }
      if (res.extracted_invoice_number && !resubmitInvoiceNumber) {
        setResubmitInvoiceNumber(res.extracted_invoice_number);
      }
    } catch (err) {
      console.error('Resubmit receipt upload failed', err);
    } finally {
      setResubmitUploading(false);
    }
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setSubmitting(true);
    try {
      const payload: Partial<ExpenseClaim> = {
        category: category as any,
        amount: parseFloat(amount),
        claim_date: claimDate,
        description,
        is_split_bill: isSplitBill,
        split_with_employee_id: isSplitBill ? '22222222-2222-2222-2222-222222222222' : undefined,
        receipt_invoice_number: invoiceNumber || undefined,
        total_receipt_amount: totalReceiptAmount ? parseFloat(totalReceiptAmount) : undefined,
        receipt_url: receiptResult?.receipt_url,
        image_sha256: receiptResult?.image_sha256,
      };

      const created = await api.submitExpenseClaim(payload);
      setMyClaims([created, ...myClaims]);

      // Reset form
      setAmount('');
      setDescription('');
      setIsSplitBill(false);
      setInvoiceNumber('');
      setTotalReceiptAmount('');
      setReceiptResult(null);
      setActiveView('my-claims');
    } catch (err: any) {
      alert(err.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewAction = async () => {
    if (!selectedClaim || !reviewAction) return;

    try {
      const updated = await api.reviewExpenseClaim(selectedClaim.id, reviewAction, reviewNote);
      setTeamClaims(teamClaims.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedClaim(null);
      setReviewNote('');
      setReviewAction(null);
    } catch (err: any) {
      alert(err.message || 'Review action failed');
    }
  };

  const openResubmitModal = (claim: ExpenseClaim) => {
    setResubmittingClaim(claim);
    setResubmitAmount(claim.amount.toString());
    setResubmitDescription(claim.description || '');
    setResubmitInvoiceNumber(claim.receipt_invoice_number || '');
    setResubmitReceipt(null);
  };

  const handleResubmitClaim = async () => {
    if (!resubmittingClaim) return;
    try {
      const payload: Partial<ExpenseClaim> = {
        amount: parseFloat(resubmitAmount),
        description: resubmitDescription,
        receipt_invoice_number: resubmitInvoiceNumber || undefined,
        receipt_url: resubmitReceipt?.receipt_url || resubmittingClaim.receipt_url,
        image_sha256: resubmitReceipt?.image_sha256 || resubmittingClaim.image_sha256,
      };

      const updated = await api.resubmitExpenseClaim(resubmittingClaim.id, payload);
      setMyClaims(myClaims.map((c) => (c.id === updated.id ? updated : c)));
      setResubmittingClaim(null);
    } catch (err: any) {
      alert(err.message || 'Resubmission failed');
    }
  };

  const openDisburseModal = (claim: ExpenseClaim) => {
    setDisburseTargetClaim(claim);
    setPaymentRefNumber(`UTR-NEFT-${Math.floor(100000 + Math.random() * 900000)}`);
    setFinanceNote('');
  };

  const handleConfirmDisbursement = async () => {
    if (!disburseTargetClaim || !paymentRefNumber) return;
    setDisbursing(true);
    try {
      const updated = await api.disburseExpenseClaim(
        disburseTargetClaim.id,
        paymentRefNumber,
        financeNote || undefined
      );
      setFinanceClaims(financeClaims.map((c) => (c.id === updated.id ? updated : c)));
      setTeamClaims(teamClaims.map((c) => (c.id === updated.id ? updated : c)));
      setMyClaims(myClaims.map((c) => (c.id === updated.id ? updated : c)));
      setDisburseTargetClaim(null);
    } catch (err: any) {
      alert(err.message || 'Failed to disburse reimbursement');
    } finally {
      setDisbursing(false);
    }
  };

  // Metrics summary
  const totalApproved = myClaims
    .filter((c) => ['manager_approved', 'zsm_approved', 'finance_verified', 'approved', 'reimbursed'].includes(c.status))
    .reduce((sum, c) => sum + c.amount, 0);

  const pendingCount = myClaims.filter((c) => c.status === 'submitted' || c.status === 'pending_zsm_approval').length;
  const sentBackCount = myClaims.filter((c) => c.status === 'sent_back').length;
  const flaggedCount = teamClaims.filter((c) => c.validation_status !== 'passed').length;

  // Finance pending liability
  const financePendingClaims = financeClaims.filter((c) =>
    ['manager_approved', 'zsm_approved', 'finance_verified', 'approved'].includes(c.status)
  );
  const totalFinancePendingAmount = financePendingClaims.reduce((sum, c) => sum + c.amount, 0);

  const renderStatusBadge = (status: ExpenseClaim['status']) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-800">
            Pending Manager Review
          </span>
        );
      case 'sent_back':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Needs Revision
          </span>
        );
      case 'pending_zsm_approval':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
            Pending ZSM Approval (&gt;₹5,000)
          </span>
        );
      case 'manager_approved':
      case 'zsm_approved':
      case 'approved':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 text-emerald-800">
            {status === 'zsm_approved' ? 'ZSM Authorized' : 'Manager Authorized'}
          </span>
        );
      case 'finance_verified':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-indigo-100 text-indigo-800">
            Finance Verified
          </span>
        );
      case 'reimbursed':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-blue-100 text-blue-800 flex items-center gap-1">
            <Check className="w-3 h-3" /> Paid / Settled
          </span>
        );
      case 'rejected':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 text-rose-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/70 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-widest">
            <Receipt className="w-4 h-4" />
            Field Reimbursements & Claims
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
            Expense Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hierarchical sales approvals, anti-fraud telemetry & dedicated Finance reimbursement queue.
          </p>
        </div>

        {/* Action Toggle Strip based on role */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 self-start sm:self-auto flex-wrap">
          {/* My Claims Tab */}
          <button
            onClick={() => setActiveView('my-claims')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeView === 'my-claims'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Claims ({myClaims.length})
            {sentBackCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded-full font-bold">
                {sentBackCount}
              </span>
            )}
          </button>

          {/* New Claim Tab (Reps, Managers, Admin) */}
          {(isRep || isManager || isAdmin) && (
            <button
              onClick={() => setActiveView('new')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'new'
                  ? 'bg-[#00897B] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              New Claim
            </button>
          )}

          {/* Team Approvals Tab (Managers & Admin) */}
          {(isManager || isAdmin) && (
            <button
              onClick={() => setActiveView('team-audit')}
              className={`relative px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'team-audit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Team Approvals ({teamClaims.length})
              {flaggedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold">
                  {flaggedCount}
                </span>
              )}
            </button>
          )}

          {/* Finance Queue Tab (Finance & Admin) */}
          {(isFinance || isAdmin) && (
            <button
              onClick={() => setActiveView('finance-queue')}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'finance-queue'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              Finance Queue ({financePendingClaims.length})
            </button>
          )}
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1 */}
        {isFinance ? (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pending Disbursals
              </span>
              <span className="text-2xl font-black text-indigo-600 mt-1 block">
                ₹{totalFinancePendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {financePendingClaims.length} claims authorized by sales
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Approved Payout
              </span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                ₹{totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#00897B] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        )}

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Submissions
            </span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">
              {pendingCount} claims
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Awaiting manager review
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Action Required / Revisions
            </span>
            <span className={`text-2xl font-black mt-1 block ${sentBackCount > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
              {sentBackCount} claims
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Sent back for bill correction
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* VIEW 1: NEW CLAIM FORM */}
      {activeView === 'new' && (
        <form onSubmit={handleSubmitClaim} className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">File New Reimbursement Claim</h2>
            <p className="text-xs text-slate-500">Attach photo receipt. Live tamper check validates camera upload timestamp delta.</p>
          </div>

          {/* Category Picker */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
              Expense Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-[#00897B] bg-teal-50/50 shadow-sm ring-2 ring-teal-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${cat.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block leading-tight">{cat.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Policy eligible</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Amount (INR ₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#00897B] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                Expense Date
              </label>
              <input
                type="date"
                required
                value={claimDate}
                onChange={(e) => setClaimDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#00897B] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Receipt Proof Capture */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Live Camera Receipt Upload (Forensic Watermarking & Delta Check)
            </label>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleCaptureReceipt}
              className="hidden"
            />

            {!receiptResult ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-teal-500 hover:bg-teal-50/20 transition-all text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#00897B] flex items-center justify-center">
                  {receiptUploading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                </div>
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    {receiptUploading ? 'Uploading & verifying timestamp...' : 'Snap Live Receipt Photo'}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Camera only with timestamp delta verification (&lt;60s)
                  </span>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                    <img src={receiptResult.receipt_url} alt="Receipt Preview" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Check className="w-3 h-3" /> Timestamp Delta &lt;60s Verified
                      </span>
                      {receiptResult.extracted_invoice_number && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                          OCR: {receiptResult.extracted_invoice_number}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block mt-1">
                      SHA256: {receiptResult.image_sha256.slice(0, 16)}...
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReceiptResult(null)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Remove receipt"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Client or Visit Remarks
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Clinic visit to Dr. Mehta, Chemist survey in Dadar"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#00897B] focus:bg-white transition-all"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-2xl bg-[#00897B] text-white font-bold text-sm hover:bg-[#00796B] transition-all shadow-md shadow-teal-700/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Submit Claim for Review
            </button>
          </div>
        </form>
      )}

      {/* VIEW 2: MY CLAIMS */}
      {activeView === 'my-claims' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Submitted Field Claims</h2>
              <p className="text-xs text-slate-500">Track approval stages across your reporting hierarchy.</p>
            </div>
            <button
              onClick={loadData}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {myClaims.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No claims submitted yet. Click "New Claim" above to file your first expense.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myClaims.map((claim) => (
                <div key={claim.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-sm capitalize">
                          {claim.category.replace('_', ' ')}
                        </span>
                        {renderStatusBadge(claim.status)}

                        {claim.is_split_bill && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Split Bill
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600">
                        {claim.description || 'No description provided'}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span>Date: {claim.claim_date}</span>
                        {claim.receipt_invoice_number && <span>Invoice: {claim.receipt_invoice_number}</span>}
                        {claim.payment_reference && (
                          <span className="font-mono text-emerald-600 font-bold">
                            UTR: {claim.payment_reference}
                          </span>
                        )}
                      </div>

                      {/* Prominent Banner if Sent Back for Revision */}
                      {claim.status === 'sent_back' && (
                        <div className="p-3 mt-2 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                              <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                              Correction Requested by Manager:
                            </span>
                            <button
                              onClick={() => openResubmitModal(claim)}
                              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
                            >
                              Edit & Resubmit
                            </button>
                          </div>
                          <p className="text-xs text-orange-800 bg-white/70 p-2 rounded-lg font-medium">
                            "{claim.manager_review_note || claim.review_note || 'Please re-attach a clear receipt photo.'}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right self-end sm:self-center shrink-0">
                    <span className="text-lg font-black text-slate-900 block">
                      ₹{claim.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {claim.status === 'reimbursed' && (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">
                        Bank Settled
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MANAGER REVIEW & AUDIT */}
      {activeView === 'team-audit' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Subordinate Claims Audit Dashboard</h2>
              <p className="text-xs text-slate-500">
                Authorizes claims $\le$ ₹5,000 directly. Escalates claims &gt; ₹5,000 to Zonal Sales Manager.
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {teamClaims.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No subordinate claims awaiting review.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {teamClaims.map((claim) => (
                <div key={claim.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {claim.employee_name || 'Field Representative'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        • {claim.claim_date}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                        {claim.category.replace('_', ' ')}
                      </span>
                      {renderStatusBadge(claim.status)}

                      {claim.amount > 5000 && claim.status === 'submitted' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          High Value (&gt; ₹5,000)
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600">
                      {claim.description || 'No description entered by representative'}
                    </p>

                    {/* Forensic Verification Flags */}
                    {claim.validation_flags?.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {claim.validation_flags.map((flag: any, i: number) => (
                          <span
                            key={i}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                              flag.severity === 'fraud'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <AlertTriangle className="w-3 h-3" /> {flag.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end lg:self-center">
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 block">
                        ₹{claim.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Manager Actions: Approve, Reject, Send Back */}
                    {(claim.status === 'submitted' || (claim.status === 'pending_zsm_approval' && isZsmOrAbove)) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setReviewAction('APPROVE');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {claim.amount > 5000 && !isZsmOrAbove ? 'Forward to ZSM' : 'Approve'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setReviewAction('SEND_BACK');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center gap-1"
                          title="Request correction from employee"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Send Back
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClaim(claim);
                            setReviewAction('REJECT');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: FINANCE DISBURSEMENT QUEUE */}
      {activeView === 'finance-queue' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                Finance & Accounts Disbursement Queue
              </h2>
              <p className="text-xs text-slate-500">
                Authorized by sales management. Verify GST/invoices, record bank UTR transaction reference, and disburse reimbursements.
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {financeClaims.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No claims currently in the finance queue.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {financeClaims.map((claim) => (
                <div key={claim.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">
                        {claim.employee_name || 'Field Representative'}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        • {claim.claim_date}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                        {claim.category.replace('_', ' ')}
                      </span>
                      {renderStatusBadge(claim.status)}
                    </div>

                    <p className="text-xs text-slate-600">
                      {claim.description || 'General operational field reimbursement'}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5 flex-wrap">
                      {claim.manager_review_note && (
                        <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md font-semibold">
                          Sales Approval: {claim.manager_review_note}
                        </span>
                      )}
                      {claim.payment_reference && (
                        <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
                          UTR Ref: {claim.payment_reference}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end lg:self-center">
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-900 block">
                        ₹{claim.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {claim.receipt_url && (
                        <a
                          href={claim.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-teal-700 hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" /> View Bill
                        </a>
                      )}
                    </div>

                    {/* Disburse Button (Finance & Admin only) */}
                    {claim.status !== 'reimbursed' && (
                      <button
                        onClick={() => openDisburseModal(claim)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                      >
                        <CreditCard className="w-4 h-4" /> Process Payout
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Modal Dialog (Managers) */}
      {selectedClaim && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">
                {reviewAction === 'APPROVE'
                  ? selectedClaim.amount > 5000 && !isZsmOrAbove
                    ? 'Forward to ZSM for Approval'
                    : 'Approve Expense Claim'
                  : reviewAction === 'SEND_BACK'
                  ? 'Send Back for Correction'
                  : 'Reject Expense Claim'}
              </h3>
              <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl">
              <p><strong>Employee:</strong> {selectedClaim.employee_name || 'Representative'}</p>
              <p><strong>Category:</strong> {selectedClaim.category}</p>
              <p><strong>Amount:</strong> ₹{selectedClaim.amount.toFixed(2)}</p>
              {selectedClaim.amount > 5000 && (
                <p className="text-purple-700 font-bold">
                  * Amount exceeds ₹5,000 threshold and will be routed to ZSM for clearance.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                {reviewAction === 'SEND_BACK'
                  ? 'Correction Feedback Note (Required for Field Rep)'
                  : 'Audit / Review Note (Optional)'}
              </label>
              <textarea
                rows={3}
                required={reviewAction === 'SEND_BACK'}
                placeholder={
                  reviewAction === 'SEND_BACK'
                    ? 'Explain what needs correction (e.g., re-upload clear bill, verify fuel mileage)...'
                    : 'Reason or reference notes...'
                }
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#00897B]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedClaim(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleReviewAction}
                disabled={reviewAction === 'SEND_BACK' && !reviewNote.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50 ${
                  reviewAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : reviewAction === 'SEND_BACK'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {reviewAction.replace('_', ' ')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resubmit Modal Dialog (Field Rep) */}
      {resubmittingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-slate-900 text-base">Edit & Resubmit Claim</h3>
              </div>
              <button onClick={() => setResubmittingClaim(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-900">
              <span className="font-bold block mb-0.5">Manager Feedback:</span>
              <p>"{resubmittingClaim.manager_review_note || resubmittingClaim.review_note || 'Please review and correct bill.'}"</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Adjust Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={resubmitAmount}
                  onChange={(e) => setResubmitAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#00897B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Updated Description / Clarification
                </label>
                <input
                  type="text"
                  value={resubmitDescription}
                  onChange={(e) => setResubmitDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#00897B]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Attach Replacement Photo Receipt
                </label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={resubmitFileInputRef}
                  onChange={handleCaptureResubmitReceipt}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => resubmitFileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-teal-500 hover:text-teal-700 flex items-center justify-center gap-2"
                >
                  {resubmitUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {resubmitReceipt ? 'Receipt Re-attached' : 'Snap New Live Receipt'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setResubmittingClaim(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleResubmitClaim}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#00897B] hover:bg-[#00796B] shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Resubmit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disburse Modal Dialog (Finance & Accounts) */}
      {disburseTargetClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Execute Bank Reimbursement</h3>
              </div>
              <button onClick={() => setDisburseTargetClaim(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between font-bold text-slate-800">
                <span>Beneficiary:</span>
                <span>{disburseTargetClaim.employee_name || 'Representative'}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800">
                <span>Payout Amount:</span>
                <span className="text-indigo-700 text-sm font-black">
                  ₹{disburseTargetClaim.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Category:</span>
                <span className="capitalize">{disburseTargetClaim.category.replace('_', ' ')}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Bank UTR / Transaction Reference (Required)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UTR-HDFC-9921481"
                  value={paymentRefNumber}
                  onChange={(e) => setPaymentRefNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Finance Voucher / Audit Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared via corporate NEFT batch 4"
                  value={financeNote}
                  onChange={(e) => setFinanceNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDisburseTargetClaim(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisbursement}
                disabled={disbursing || !paymentRefNumber.trim()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {disbursing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Transfer & Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
