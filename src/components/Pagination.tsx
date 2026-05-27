import React from 'react';
import './Pagination.css';
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const maxPagesToShow = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = startPage + maxPagesToShow - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination-container fade-in">
      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(1)} 
        disabled={currentPage === 1}
      >
        <ChevronFirst size={20} />
      </button>

      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1}
      >
        <ChevronLeft size={20} />
      </button>
      
      <div className="page-numbers">
        {startPage > 1 && <span className="ellipsis">...</span>}
        
        {pages.map(p => (
          <button 
            key={p}
            className={`page-num-btn ${currentPage === p ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        
        {endPage < totalPages && <span className="ellipsis">...</span>}
      </div>

      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages}
      >
        <ChevronRight size={20} />
      </button>

      <button 
        className="page-nav-btn" 
        onClick={() => onPageChange(totalPages)} 
        disabled={currentPage === totalPages}
      >
        <ChevronLast size={20} />
      </button>
    </div>
  );
};

export default Pagination;
