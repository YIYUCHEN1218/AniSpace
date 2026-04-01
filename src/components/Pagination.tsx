import React from 'react';
import './Pagination.css';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-container fade-in">
      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1}
      >
        <ChevronLeft size={20} />
      </button>
      
      <span className="page-info">
        第 {currentPage} 頁，共 {totalPages} 頁
      </span>

      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};

export default Pagination;
