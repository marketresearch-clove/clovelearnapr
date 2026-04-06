import React, { useState, useEffect, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import { supabase } from '../lib/supabaseClient';

interface AckRecord {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  block_id: string;
  policy_title: string;
  signature: string;
  acknowledged_at: string;
  user_name: string;
  user_email: string;
  user_department: string;
  course_title: string;
  course_type: string;
}

interface Template {
  id: string;
  name: string;
  letterheadImage?: string;
  letterheadHeight?: number;
  cropArea?: { x: number; y: number; width: number; height: number };
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  companyName?: string;
  fontSize?: number;
  accentColor?: string;
}

const AcknowledgementsPage: React.FC = () => {
  const [records, setRecords] = useState<AckRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'document' | 'user'>('document');
  const [filterDept, setFilterDept] = useState('all');
  const [filterPolicy, setFilterPolicy] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AckRecord | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [templates, setTemplates] = useState<Template[]>(() => {
    const saved = localStorage.getItem('ackTemplates');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateConfig, setShowTemplateConfig] = useState(false);
  const [letterheadImage, setLetterheadImage] = useState<string | null>(null);

  useEffect(() => {
    fetchAcknowledgements();
  }, []);

  const handleLetterheadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result as string;
      setLetterheadImage(data);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTemplate = (name: string) => {
    if (!letterheadImage) return;
    const newTemplate: Template = {
      id: Date.now().toString(),
      name,
      letterheadImage,
      letterheadHeight: 80,
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 30,
      marginRight: 30,
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('ackTemplates', JSON.stringify(updated));
    setLetterheadImage(null);
  };

  const handleRemoveTemplate = (id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('ackTemplates', JSON.stringify(updated));
    if (selectedTemplateId === id) setSelectedTemplateId(null);
  };

  const fetchAcknowledgements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_acknowledgements')
        .select(`
          id, user_id, course_id, lesson_id, block_id,
          policy_title, signature, acknowledged_at,
          profiles:user_id (fullname, email, department),
          courses:course_id (title, course_type)
        `)
        .order('acknowledged_at', { ascending: false });

      if (error) throw error;

      const flat: AckRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        course_id: r.course_id,
        lesson_id: r.lesson_id,
        block_id: r.block_id,
        policy_title: r.policy_title || 'Policy Document',
        signature: r.signature,
        acknowledged_at: r.acknowledged_at,
        user_name: r.profiles?.fullname || 'Unknown',
        user_email: r.profiles?.email || '',
        user_department: r.profiles?.department || 'N/A',
        course_title: r.courses?.title || 'Unknown Course',
        course_type: r.courses?.course_type || 'policy',
      }));

      setRecords(flat);
    } catch (err) {
      console.error('Error fetching acknowledgements:', err);
    } finally {
      setLoading(false);
    }
  };

  // Unique filter options
  const departments = Array.from(new Set(records.map(r => r.user_department).filter(Boolean)));
  const policies = Array.from(new Set(records.map(r => r.policy_title).filter(Boolean)));
  const courses = Array.from(new Set(records.map(r => r.course_title).filter(Boolean)));
  const users = Array.from(new Set(records.map(r => r.user_name).filter(Boolean)));

  const filtered = records.filter(r => {
    const q = searchQuery.toLowerCase();
    return (
      (filterDept === 'all' || r.user_department === filterDept) &&
      (filterPolicy === 'all' || r.policy_title === filterPolicy) &&
      (filterCourse === 'all' || r.course_title === filterCourse) &&
      (filterUser === 'all' || r.user_name === filterUser) &&
      (!q || r.user_name.toLowerCase().includes(q) || r.policy_title.toLowerCase().includes(q) || r.course_title.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q))
    );
  });

  // Group by document (policy_title) or user
  const grouped: Record<string, AckRecord[]> = {};
  if (viewMode === 'document') {
    filtered.forEach(r => {
      const key = r.policy_title;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
  } else {
    filtered.forEach(r => {
      const key = r.user_name;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
  }

  const handlePrint = (record: AckRecord) => {
    setSelectedRecord(record);
    const selectedTemplate = selectedTemplateId ? templates.find(t => t.id === selectedTemplateId) : null;

    setTimeout(() => {
      const win = window.open('', '_blank');
      if (!win) return;

      const letterheadHTML = selectedTemplate?.letterheadImage
        ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${selectedTemplate.letterheadImage}" alt="Letterhead" style="max-height: ${selectedTemplate.letterheadHeight || 80}px; max-width: 100%;"/></div>`
        : '';

      const margins = selectedTemplate ? {
        top: selectedTemplate.marginTop || 40,
        bottom: selectedTemplate.marginBottom || 40,
        left: selectedTemplate.marginLeft || 30,
        right: selectedTemplate.marginRight || 30,
      } : { top: 40, bottom: 40, left: 30, right: 30 };

      win.document.write(`
        <html><head><title>Acknowledgement - ${record.policy_title}</title>
        <style>
          body { 
            font-family: 'Times New Roman', serif; 
            margin: 0; 
            padding: ${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px; 
            color: #111; 
          }
          .letterhead { margin-bottom: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #1a1a2e; }
          .doc-title { font-size: 20px; font-weight: bold; margin: 16px 0 4px; }
          .sub { font-size: 13px; color: #555; }
          .section { margin: 20px 0; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 500; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .signature { font-family: cursive, Georgia, serif; font-size: 22px; font-weight: bold; color: #1a1a2e; border-bottom: 2px solid #333; padding-bottom: 6px; display: inline-block; min-width: 200px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 11px; color: #888; text-align: center; }
          @media print { body { padding: 20px; } }
        </style></head><body>
        ${letterheadHTML}
        <div class="header">
          <div class="logo">ACKNOWLEDGEMENT CERTIFICATE</div>
          <div class="doc-title">${record.policy_title}</div>
          <div class="sub">Official Record of Policy Acknowledgement</div>
        </div>
        <div class="section">
          <p style="font-size:14px;line-height:1.8;">
            This document certifies that the individual named below, an employee of <strong>CLOVE TECHNOLOGIES PRIVATE LIMITED</strong>, has read, understood, and formally acknowledged the
            <strong>${record.policy_title}</strong> as part of the course
            <strong>${record.course_title}</strong>.
          </p>
        </div>
        <div class="grid">
          <div class="section">
            <div class="label">Employee Name</div>
            <div class="value">${record.user_name}</div>
          </div>
          <div class="section">
            <div class="label">Email Address</div>
            <div class="value">${record.user_email}</div>
          </div>
          <div class="section">
            <div class="label">Department</div>
            <div class="value">${record.user_department}</div>
          </div>
          <div class="section">
            <div class="label">Course</div>
            <div class="value">${record.course_title}</div>
          </div>
          <div class="section">
            <div class="label">Policy / Document</div>
            <div class="value">${record.policy_title}</div>
          </div>
          <div class="section">
            <div class="label">Acknowledged On</div>
            <div class="value">${new Date(record.acknowledged_at).toLocaleString()}</div>
          </div>
        </div>
        <div class="grid" style="margin-top:40px;">
          <div class="section">
            <div class="label">Employee / Learner Signature</div>
            <div style="margin-top:10px;"><span class="signature">${record.signature}</span></div>
            <p style="font-size:10px;color:#888;margin-top:6px;">Acknowledgement</p>
          </div>
          <div class="section">
            <div style="height:80px;"></div>
          </div>
        </div>

        <div class="grid" style="margin-top:30px;">
          <div class="section">
            <div class="label">HR Signature</div>
            <div style="margin-top:10px;"><span class="signature">Sreenath P</span></div>
            <p style="font-size:10px;color:#888;margin-top:6px;">HR – Lead</p>
          </div>
          <div class="section">
            <div class="label">COO Signature</div>
            <div style="margin-top:10px;"><span class="signature">Sidharth Kamasani</span></div>
            <p style="font-size:10px;color:#888;margin-top:6px;">Chief Operating Officer</p>
          </div>
        </div>
        <div class="footer">
          Document ID: ${record.id} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()}
        </div>
        </body></html>
      `);
      win.document.close();
      win.focus();
      win.print();
    }, 100);
  };

  const handleDownloadCSV = () => {
    const rows = filtered.map(r => ({
      'Policy / Document': r.policy_title,
      'Course': r.course_title,
      'Employee Name': r.user_name,
      'Email': r.user_email,
      'Department': r.user_department,
      'Signature': r.signature,
      'Acknowledged On': new Date(r.acknowledged_at).toLocaleString(),
    }));
    const csv = [Object.keys(rows[0]).join(','), ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Acknowledgements_Report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Policy Acknowledgements">
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader size="lg" message="Loading acknowledgements..." />
        </div>
      ) : (
        <div className="space-y-5">

          {/* Template Configuration Section */}
          <div className="bg-white rounded-xl border border-gray-300">
            <button
              onClick={() => setShowTemplateConfig(!showTemplateConfig)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-100 hover:bg-blue-150 transition-colors text-left border-b border-gray-300"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-blue-700">palette</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Configure Document Templates</h3>
                  <p className="text-xs text-gray-700 mt-0.5">Upload letterhead and customize acknowledgement document appearance</p>
                </div>
              </div>
              <span className={`material-symbols-rounded text-gray-700 font-semibold transition-transform ${showTemplateConfig ? 'rotate-180' : ''}`}>expand_more</span>
            </button>

            {showTemplateConfig && (
              <div className="p-5 space-y-4">
                {/* Quick Letterhead Upload */}
                <div className="bg-blue-50 border-2 border-dashed border-blue-400 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-rounded text-blue-700 text-2xl">image</span>
                    <div>
                      <h4 className="font-semibold text-gray-900">Upload Letterhead Image</h4>
                      <p className="text-xs text-gray-700">PNG, JPG, or GIF (max 5MB)</p>
                    </div>
                  </div>

                  {letterheadImage ? (
                    <div className="space-y-3">
                      <img src={letterheadImage} alt="Letterhead" className="max-h-32 bg-white p-2 rounded border border-gray-400" />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Template name..."
                          id="template-name-input"
                          className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-gray-900"
                        />
                        <button
                          onClick={() => {
                            const name = (document.getElementById('template-name-input') as HTMLInputElement)?.value || 'Template ' + (templates.length + 1);
                            handleSaveTemplate(name);
                            (document.getElementById('template-name-input') as HTMLInputElement).value = '';
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Save Template
                        </button>
                        <button
                          onClick={() => setLetterheadImage(null)}
                          className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          <span className="material-symbols-rounded">close</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="text-center py-4">
                        <span className="material-symbols-rounded text-gray-600 text-4xl block mb-2">cloud_upload</span>
                        <p className="text-sm font-medium text-gray-800">Click to upload or drag and drop</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLetterheadUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Saved Templates */}
                {templates.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Saved Templates</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {templates.map(t => (
                        <div
                          key={t.id}
                          onClick={() => setSelectedTemplateId(t.id)}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedTemplateId === t.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                          {t.letterheadImage && (
                            <img src={t.letterheadImage} alt={t.name} className="w-full h-20 object-contain mb-2 bg-white rounded p-1 border border-gray-300" />
                          )}
                          <p className="text-xs font-medium text-gray-900 truncate mb-2">{t.name}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTemplate(t.id);
                            }}
                            className="w-full px-2 py-1 text-xs text-red-700 hover:bg-red-100 rounded transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    {selectedTemplateId && (
                      <p className="text-xs text-green-700 mt-3">✓ Template selected for printing</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Policy Acknowledgements</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {filtered.length} signed acknowledgement{filtered.length !== 1 ? 's' : ''} · {Object.keys(grouped).length} {viewMode === 'document' ? 'documents' : 'employees'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <span className="material-symbols-rounded text-sm">download</span>
                Export CSV
              </button>
            </div>
          </div>

          {/* View Toggle + Filters */}
          <div className="bg-white rounded-xl border border-gray-300 p-4 space-y-3">
            {/* View mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide mr-2">View by:</span>
              {(['document', 'user'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === m
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-sm">{m === 'document' ? 'policy' : 'person'}</span>
                    {m === 'document' ? 'Document / Policy' : 'Employee / User'}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 w-48 text-gray-900"
                />
              </div>

              <select value={filterPolicy} onChange={e => setFilterPolicy(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-gray-900">
                <option value="all">All Documents</option>
                {policies.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-gray-900">
                <option value="all">All Courses</option>
                {courses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-gray-900">
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 text-gray-900">
                <option value="all">All Employees</option>
                {users.map(u => <option key={u} value={u}>{u}</option>)}
              </select>

              {(filterPolicy !== 'all' || filterCourse !== 'all' || filterDept !== 'all' || filterUser !== 'all' || searchQuery) && (
                <button
                  onClick={() => { setFilterPolicy('all'); setFilterCourse('all'); setFilterDept('all'); setFilterUser('all'); setSearchQuery(''); }}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-rounded text-sm">close</span> Clear
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          {Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-300">
              <span className="material-symbols-rounded text-5xl text-gray-400 block mb-3">policy</span>
              <p className="text-gray-600 font-medium">No acknowledgements found</p>
              <p className="text-sm text-gray-600 mt-1">Acknowledgements appear here after learners sign policy lessons.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([groupKey, groupRecords]) => (
                  <GroupCard
                    key={groupKey}
                    groupKey={groupKey}
                    records={groupRecords}
                    viewMode={viewMode}
                    onPrint={handlePrint}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
};

/* ── Group Card ── */
const GroupCard: React.FC<{
  groupKey: string;
  records: AckRecord[];
  viewMode: 'document' | 'user';
  onPrint: (r: AckRecord) => void;
}> = ({ groupKey, records, viewMode, onPrint }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-300 overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-100 hover:bg-gray-150 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`material-symbols-rounded flex-shrink-0 ${viewMode === 'document' ? 'text-orange-500' : 'text-blue-500'}`}>
            {viewMode === 'document' ? 'policy' : 'person'}
          </span>
          <span className="font-semibold text-gray-900 text-sm truncate">{groupKey}</span>
          <span className="text-xs text-gray-600 flex-shrink-0">
            {records.length} acknowledgement{records.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className={`material-symbols-rounded text-gray-400 flex-shrink-0 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}>
          expand_more
        </span>
      </button>

      {/* Records table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200 bg-blue-50">
                {viewMode === 'document' ? (
                  <>
                    <th className="py-2 pl-5 pr-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Employee</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Department</th>
                  </>
                ) : (
                  <>
                    <th className="py-2 pl-5 pr-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Document / Policy</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Course</th>
                  </>
                )}
                <th className="py-2 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Signature</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">Acknowledged</th>
                <th className="py-2 pl-3 pr-5 text-xs font-semibold text-gray-700 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-gray-100 transition-colors">
                  {viewMode === 'document' ? (
                    <>
                      <td className="py-3 pl-5 pr-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.user_name}</p>
                          <p className="text-xs text-gray-600">{r.user_email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">
                          {r.user_department}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 pl-5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-rounded text-orange-400 text-sm">policy</span>
                          <p className="text-sm font-medium text-gray-900">{r.policy_title}</p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-xs text-gray-600">{r.course_title}</p>
                      </td>
                    </>
                  )}
                  <td className="py-3 px-3">
                    <span className="font-medium text-sm text-gray-800" style={{ fontFamily: 'cursive, Georgia, serif' }}>
                      {r.signature}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700 whitespace-nowrap">
                    {new Date(r.acknowledged_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    <span className="block text-xs text-gray-600">
                      {new Date(r.acknowledged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onPrint(r)}
                        title="Print / Download"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-rounded text-sm">print</span>
                        Print
                      </button>
                      <button
                        onClick={() => onPrint(r)}
                        title="Download PDF"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-rounded text-sm">download</span>
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AcknowledgementsPage;
