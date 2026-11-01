import React from 'react';
import { Search, LayoutGrid, List, Filter, SortAsc } from 'lucide-react';
import { ReportCategory, ReportStatus } from '../types';

interface WorkspaceControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  selectedProject: string;
  onSelectProject: (proj: string) => void;
  projectsList: string[];
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewLayout: 'grid' | 'table';
  onViewLayoutChange: (layout: 'grid' | 'table') => void;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus,
  selectedProject,
  onSelectProject,
  projectsList,
  sortBy,
  onSortChange,
  viewLayout,
  onViewLayoutChange
}) => {
  const categories: (ReportCategory | 'ALL')[] = ['ALL', 'Báo cáo ngày', 'Báo cáo tuần', 'Báo cáo tháng', 'Tài liệu khác'];
  const statuses: (ReportStatus | 'ALL')[] = ['ALL', 'To-do', 'In Progress', 'Pending Review', 'Done', 'Sent'];

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 shadow-sm space-y-4">
      
      {/* Row 1: Search & Filter Pills */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm tiêu đề, file, dự án, ghi chú..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-baemin focus:ring-1 focus:ring-baemin transition-all"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all border baemin-hover-pop ${
                selectedCategory === cat
                  ? 'bg-baemin text-slate-950 border-baemin shadow-baemin font-extrabold'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'Tất cả danh mục' : cat}
            </button>
          ))}
        </div>

      </div>

      {/* Row 2: Secondary Filters & Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
        
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline mr-1">Trạng thái:</span>
          {statuses.map(st => (
            <button
              key={st}
              onClick={() => onSelectStatus(st)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all border ${
                selectedStatus === st
                  ? 'bg-baemin text-slate-950 border-baemin shadow-sm font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              {st === 'ALL' ? 'Tất cả' : st}
            </button>
          ))}
        </div>

        {/* Project Selector, Sort, View Layout */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          
          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-baemin"
          >
            <option value="ALL">Tất cả Dự án</option>
            {projectsList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Sort Select */}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-baemin"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="title-asc">Tên: A → Z</option>
            <option value="title-desc">Tên: Z → A</option>
          </select>

          {/* Layout Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => onViewLayoutChange('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewLayout === 'grid' ? 'bg-baemin text-slate-950 font-bold shadow-baemin-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
              title="Dạng Lưới Card"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewLayoutChange('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewLayout === 'table' ? 'bg-baemin text-slate-950 font-bold shadow-baemin-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
              title="Dạng Bảng Danh Sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
