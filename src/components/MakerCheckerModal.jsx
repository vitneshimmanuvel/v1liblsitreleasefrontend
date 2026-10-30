import React, { useState } from 'react';
import { 
  X, 
  CheckCircle, 
  Clock, 
  User, 
  FileText, 
  Check, 
  Trash2, 
  ExternalLink, 
  Send, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';
import { apiService } from '../services/apiService';

export default function MakerCheckerModal({
  isOpen,
  onClose,
  items = [],
  history = [],
  drafts = [],
  policies = [],
  currentUser,
  onAction,
  onCloseItem,
  onSelectPolicy,
  onRefresh
}) {
  // Determine role: Manager/Admin/Owner is Bank Owner; otherwise Bank Employee
  const isBankOwner = currentUser?.roleType === 'manager' || currentUser?.roleType === 'admin' || currentUser?.roleType === 'owner';
  const isEmployee = !isBankOwner;

  // Active tab defaults to 'drafts' for employees and 'in_review' for bank owners
  const [activeTab, setActiveTab] = useState(isBankOwner ? 'in_review' : 'drafts');
  const [selectedReviewItem, setSelectedReviewItem] = useState(null);
  const [selectedDraftItem, setSelectedDraftItem] = useState(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(isBankOwner ? 'in_review' : 'drafts');
    }
  }, [isOpen, isBankOwner]);

  // Combine drafts from maker-checker endpoint and policies table
  const allDraftsList = React.useMemo(() => {
    const list = [...(drafts || [])];
    (policies || []).forEach(p => {
      if (p.status === 'draft' && !list.some(d => d.id === p.id)) {
        list.push(p);
      }
    });
    return list;
  }, [drafts, policies]);

  const currentUserName = currentUser?.name?.toLowerCase().trim() || '';

  const userDrafts = React.useMemo(() => {
    if (!currentUserName || isBankOwner) return allDraftsList;
    return allDraftsList.filter(d => {
      const creator = (d.created_by || d.requested_by || '').toLowerCase();
      return creator.includes(currentUserName) || currentUserName.includes(creator);
    });
  }, [allDraftsList, isBankOwner, currentUserName]);

  if (!isOpen) return null;

  const currentReviewItem = selectedReviewItem || items[0] || null;
  const currentDraftItem = selectedDraftItem || userDrafts[0] || null;

  const handleAction = async (action) => {
    if (!currentReviewItem) return;
    setIsSubmitting(true);
    try {
      await onAction(currentReviewItem.id, action, currentUser?.name || 'Department Manager', comments);
      setComments('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('Are you sure you want to delete this saved draft?')) return;
    setIsSubmitting(true);
    try {
      await apiService.deletePolicy(draftId);
      if (selectedDraftItem?.id === draftId) {
        setSelectedDraftItem(null);
      }
      if (onRefresh) onRefresh();
      alert('Draft removed successfully.');
    } catch (err) {
      console.error('Failed to delete draft:', err);
      alert('Failed to delete draft: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishDraft = async (draft) => {
    setIsSubmitting(true);
    try {
      await apiService.togglePolicyStatus(draft.id, 'active', currentUser?.name || 'Bank Owner');
      alert(`Policy "${draft.title}" published as active!`);
      if (onRefresh) onRefresh();
      if (onSelectPolicy) onSelectPolicy(draft.id);
    } catch (err) {
      console.error('Failed to publish draft:', err);
      alert('Failed to publish draft: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDraftForApproval = async (draft) => {
    setIsSubmitting(true);
    try {
      await apiService.createMakerCheckerItem({
        policy_id: draft.id,
        policy_title: draft.title,
        title: draft.title,
        department_name: draft.department_name || 'Retail Banking',
        department: draft.department_name || 'Retail Banking',
        maker_name: currentUser?.name || 'Staff User',
        requested_by: `${currentUser?.name || 'Staff User'} (${currentUser?.role || 'Staff'})`,
        change_details: `Draft policy submitted for manager sign-off. Title: ${draft.title}. Summary: ${draft.summary || 'None'}`,
        status: 'pending'
      });
      alert(`Draft "${draft.title}" submitted for review! It now appears in "In Review".`);
      if (onRefresh) onRefresh();
      setActiveTab('in_review');
    } catch (err) {
      console.error('Failed to submit draft for approval:', err);
      alert('Failed to submit draft: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to extract sections from draft parameters
  const getDraftSections = (draft) => {
    if (!draft) return [];
    let params = draft.parameters;
    if (typeof params === 'string') {
      try { params = JSON.parse(params); } catch { params = {}; }
    }
    return params?.sections || [];
  };

  const getDraftParams = (draft) => {
    if (!draft) return {};
    let params = draft.parameters;
    if (typeof params === 'string') {
      try { params = JSON.parse(params); } catch { params = {}; }
    }
    return params || {};
  };

  const draftSections = getDraftSections(currentDraftItem);
  const draftParams = getDraftParams(currentDraftItem);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#e5e7eb] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header (Clean - subtitle removed) */}
        <div className="px-6 py-4 border-b border-[#e5e7eb] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-base shadow-2xs">
              ⚖️
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827]">Maker-Checker Governance Workflow</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch: Drafts first for Employee; In Review first for Bank Owner */}
        <div className="px-6 pt-3 flex gap-4 border-b border-[#e5e7eb] bg-slate-50/60">
          {/* If Employee: Drafts comes first */}
          {isEmployee && (
            <button
              type="button"
              onClick={() => setActiveTab('drafts')}
              className={`pb-2.5 px-2 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'drafts'
                  ? 'border-[#0057B8] text-[#0057B8]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Drafts</span>
              <span className="px-2 py-0.2 rounded-full text-[11px] bg-blue-100 text-[#0057B8] font-bold">
                {userDrafts.length}
              </span>
            </button>
          )}

          {/* In Review Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('in_review')}
            className={`pb-2.5 px-2 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'in_review'
                ? 'border-[#0057B8] text-[#0057B8]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>In Review</span>
            <span className="px-2 py-0.2 rounded-full text-[11px] bg-amber-100 text-amber-900 font-bold">
              {items.length}
            </span>
          </button>

          {/* If Bank Owner: Drafts comes second */}
          {!isEmployee && (
            <button
              type="button"
              onClick={() => setActiveTab('drafts')}
              className={`pb-2.5 px-2 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'drafts'
                  ? 'border-[#0057B8] text-[#0057B8]'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>Drafts</span>
              <span className="px-2 py-0.2 rounded-full text-[11px] bg-blue-100 text-[#0057B8] font-bold">
                {userDrafts.length}
              </span>
            </button>
          )}

          {/* Approval History */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-2 text-[13px] font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-[#0057B8] text-[#0057B8]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Approval History</span>
            <span className="px-2 py-0.2 rounded-full text-[11px] bg-slate-200 text-slate-700">
              {history.length}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {/* TAB 1: IN REVIEW (What is submitted for request / review) */}
          {activeTab === 'in_review' && (
            items.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700 text-base">All clear! No pending review items.</p>
                <p className="text-[12px] mt-1 text-slate-500">Maker submissions will appear here for Department Manager review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* List column */}
                <div className="space-y-2 md:col-span-1 border-r border-slate-100 pr-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Action Queue ({items.length})</h3>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedReviewItem(item)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        currentReviewItem?.id === item.id
                          ? 'border-[#0057B8] bg-[#0057B8]/5 shadow-xs ring-1 ring-[#0057B8]/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.department_name || 'Retail Lending'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1">{item.policy_title}</h4>
                      <p className="text-[12px] text-slate-500 mt-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> {item.maker_name}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Details & Decision Column */}
                <div className="md:col-span-2 space-y-4">
                  {currentReviewItem && (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Change Request #{currentReviewItem.id}</span>
                            <h3 className="text-base font-bold text-slate-900 mt-0.5">{currentReviewItem.policy_title}</h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => onCloseItem && onCloseItem(currentReviewItem.id)}
                            title="Toggle close action item"
                            className="px-3 py-1 text-[12px] font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-slate-500" />
                            <span>Close Item</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200 text-[12.5px]">
                          <div>
                            <span className="text-slate-500">Submitted By:</span>
                            <p className="font-semibold text-slate-800">{currentReviewItem.maker_name} ({currentReviewItem.maker_role || 'Maker'})</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Timestamp:</span>
                            <p className="font-semibold text-slate-800">{new Date(currentReviewItem.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Proposed Changes Preview */}
                      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Proposed Amendments</h4>
                        {currentReviewItem.proposed_changes ? (
                          <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3.5 text-[12.5px] space-y-2">
                            {typeof currentReviewItem.proposed_changes === 'string' ? (
                              <p className="text-slate-800 font-mono text-[12px] whitespace-pre-line">{currentReviewItem.proposed_changes}</p>
                            ) : (
                              <>
                                {currentReviewItem.proposed_changes.title && (
                                  <div>
                                    <span className="font-bold text-amber-900">Updated Title:</span>{' '}
                                    <span className="text-slate-800">{currentReviewItem.proposed_changes.title}</span>
                                  </div>
                                )}
                                {currentReviewItem.proposed_changes.content && (
                                  <div>
                                    <span className="font-bold text-amber-900">Proposed Clauses:</span>
                                    <p className="mt-1 text-slate-800 bg-white p-2.5 rounded border border-amber-200 font-mono text-[12px] whitespace-pre-line">
                                      {currentReviewItem.proposed_changes.content}
                                    </p>
                                  </div>
                                )}
                                {currentReviewItem.proposed_changes.justification && (
                                  <div>
                                    <span className="font-bold text-amber-900">Justification:</span>
                                    <p className="mt-0.5 text-slate-700 italic">&quot;{currentReviewItem.proposed_changes.justification}&quot;</p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-400 text-xs">No proposed changes recorded.</p>
                        )}
                      </div>

                      {/* Checker Comments & Sign-off Actions for Bank Owner / Approver */}
                      {isBankOwner ? (
                        <div className="space-y-3 pt-2">
                          <label className="block text-[12px] font-semibold text-slate-700">Approver Sign-off Comments</label>
                          <textarea
                            rows={2}
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="e.g. Approved operational thresholds as reviewed with Credit Operations Squad."
                            className="w-full p-2.5 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:border-[#0057B8] focus:ring-2 focus:ring-[#0057B8]/15"
                          />

                          <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAction('reject')}
                              disabled={isSubmitting}
                              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-[13px] font-medium transition cursor-pointer"
                            >
                              Reject Proposal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction('approve')}
                              disabled={isSubmitting}
                              className="px-5 py-2 bg-[#0057B8] hover:bg-[#004EA6] text-white rounded-lg text-[13px] font-semibold shadow-xs transition cursor-pointer"
                            >
                              {isSubmitting ? 'Approving...' : 'Approve & Increment to v1.1'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Direct Status View for Bank Employee (Maker) */
                        <div className="bg-gradient-to-r from-blue-50/70 via-sky-50/40 to-slate-50 border border-blue-200/80 rounded-xl p-4 text-xs space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                              <span className="font-bold text-slate-900 text-[13px]">Submitted Proposal — Awaiting Manager Adjudication</span>
                            </div>
                            <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10.5px] uppercase tracking-wide border border-amber-300">
                              In Review
                            </span>
                          </div>
                          <p className="text-slate-600 leading-relaxed text-[12px]">
                            This policy amendment was authored by <strong>{currentReviewItem.maker_name || currentUser?.name || 'Bank Employee'}</strong> and has been submitted to the governance queue. Marcus Vance (Bank Owner / Department Manager) will review, sign off, or request revisions.
                          </p>
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 border-t border-slate-200/70">
                            <span>Request: <strong className="font-mono text-slate-800">CR-#{currentReviewItem.id}</strong></span>
                            <span>•</span>
                            <span>Maker: <strong className="text-slate-800">{currentReviewItem.maker_name}</strong></span>
                            <span>•</span>
                            <span>Status: <strong className="text-amber-700 uppercase font-bold">{currentReviewItem.status || 'Pending'}</strong></span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {/* TAB 2: DRAFTS (Saved drafts for this particular user) */}
          {activeTab === 'drafts' && (
            userDrafts.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-700 text-base">No saved drafts found for {currentUser?.name || 'this user'}.</p>
                <p className="text-[12px] mt-1 text-slate-500">
                  When you author a document and click &quot;Save to Draft&quot;, it will appear right here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Drafts List Column */}
                <div className="space-y-2 md:col-span-1 border-r border-slate-100 pr-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Saved Drafts ({userDrafts.length})
                    </h3>
                    <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      Draft Mode
                    </span>
                  </div>

                  {userDrafts.map((draft) => {
                    const isSelected = currentDraftItem?.id === draft.id;
                    return (
                      <div
                        key={draft.id}
                        onClick={() => setSelectedDraftItem(draft)}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0057B8] bg-blue-50/50 shadow-xs ring-1 ring-[#0057B8]/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            Draft
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(draft.updated_at || draft.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1">{draft.title}</h4>
                        <div className="flex items-center justify-between text-[11.5px] text-slate-500 mt-1">
                          <span className="truncate">{draft.department_name || 'Retail Banking'}</span>
                          <span className="text-slate-400 text-[10.5px] flex items-center gap-1">
                            <User className="w-3 h-3" /> {draft.created_by || 'Me'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Draft Details & Actions Column */}
                <div className="md:col-span-2 space-y-4">
                  {currentDraftItem && (
                    <>
                      {/* Overview Header */}
                      <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200/80">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Draft Document
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                {currentDraftItem.department_name || 'Retail Banking'}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 mt-1">{currentDraftItem.title}</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-amber-200/60 text-[12px]">
                          <div>
                            <span className="text-slate-500 block text-[11px]">Author / User:</span>
                            <p className="font-semibold text-slate-800">{currentDraftItem.created_by || currentUser?.name || 'Staff User'}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Last Updated:</span>
                            <p className="font-semibold text-slate-800">{new Date(currentDraftItem.updated_at || currentDraftItem.created_at || Date.now()).toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[11px]">Status:</span>
                            <p className="font-bold text-amber-800">Draft (Unpublished)</p>
                          </div>
                        </div>
                      </div>

                      {/* Summary & Scope */}
                      {currentDraftItem.summary && (
                        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Executive Summary & Scope</h4>
                          <p className="text-xs text-slate-700 leading-relaxed">{currentDraftItem.summary}</p>
                        </div>
                      )}

                      {/* SLA and Limits Parameters Grid */}
                      {(draftParams.turnaround_sla || draftParams.daily_limit || draftParams.approval_limits?.officer_cap) && (
                        <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase block">Turnaround SLA</span>
                            <span className="font-semibold text-slate-800">{draftParams.turnaround_sla || '4 Hours'}</span>
                          </div>
                          <div>
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase block">Daily Limit</span>
                            <span className="font-semibold text-slate-800">{draftParams.daily_limit || '$25,000 AUD'}</span>
                          </div>
                          <div>
                            <span className="text-[10.5px] font-bold text-slate-500 uppercase block">Officer Cap</span>
                            <span className="font-semibold text-slate-800">{draftParams.approval_limits?.officer_cap || '$100,000 AUD'}</span>
                          </div>
                        </div>
                      )}

                      {/* Clauses Preview */}
                      <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#0057B8]" />
                            <span>Draft Clauses ({draftSections.length > 0 ? draftSections.length : 1})</span>
                          </h4>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {(currentDraftItem.content || '').length} characters
                          </span>
                        </div>

                        {draftSections.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                            {draftSections.map((sec, i) => (
                              <div key={sec.id || i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                                <span className="font-bold text-slate-800 block">{sec.title || `Section ${i + 1}`}</span>
                                <p className="text-slate-600 line-clamp-2 text-[11.5px]">{sec.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                            {currentDraftItem.content || 'Draft clauses authored in system.'}
                          </div>
                        )}
                      </div>

                      {/* Draft Action Buttons */}
                      <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(currentDraftItem.id)}
                          disabled={isSubmitting}
                          className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete Draft</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {/* Open & Edit in Workspace */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectPolicy) onSelectPolicy(currentDraftItem.id);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                            <span>Open in Workspace</span>
                          </button>

                          {/* Submit / Publish */}
                          {isBankOwner ? (
                            <button
                              type="button"
                              onClick={() => handlePublishDraft(currentDraftItem)}
                              disabled={isSubmitting}
                              className="px-5 py-2 text-xs font-bold text-white bg-[#0057B8] hover:bg-[#004EA6] rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <Check className="w-4 h-4" />
                              <span>Publish as Active Policy</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSubmitDraftForApproval(currentDraftItem)}
                              disabled={isSubmitting}
                              className="px-5 py-2 text-xs font-bold text-white bg-[#0057B8] hover:bg-[#004EA6] rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Submit for Approval</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          )}

          {/* TAB 3: APPROVAL HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Historical Sign-offs</h3>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No sign-off history recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {history.map((h) => (
                    <div key={h.id} className="p-4 bg-white flex items-start justify-between gap-4 text-[13px]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            h.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {h.status}
                          </span>
                          <span className="font-bold text-slate-800">{h.policy_title}</span>
                        </div>
                        <p className="text-[12px] text-slate-500">
                          Maker: <strong>{h.maker_name}</strong> • Approver: <strong>{h.checker_name || 'Marcus Vance'}</strong>
                        </p>
                        {h.checker_comments && (
                          <p className="text-[12px] text-slate-600 italic">&quot;{h.checker_comments}&quot;</p>
                        )}
                      </div>
                      <span className="text-[11.5px] text-slate-400 whitespace-nowrap">
                        {new Date(h.reviewed_at || h.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
