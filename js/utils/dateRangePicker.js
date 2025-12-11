// Custom Date Range Picker - matches glassmorphism UI
export class DateRangePicker {
    constructor(inputElement, options = {}) {
        this.input = inputElement;
        this.options = {
            onRangeSelect: options.onRangeSelect || (() => {}),
            onClear: options.onClear || (() => {}),
            ...options
        };
        
        this.startDate = null;
        this.endDate = null;
        this.isOpen = false;
        this.currentMonth = new Date();
        this.calendar = null;
        
        this.init();
    }
    
    init() {
        this.createCalendar();
        this.attachEvents();
        this.updateInputDisplay();
    }
    
    createCalendar() {
        // Create calendar container
        this.calendar = document.createElement('div');
        this.calendar.className = 'custom-date-range-picker';
        this.calendar.style.display = 'none';
        document.body.appendChild(this.calendar);
        
        this.renderCalendar();
    }
    
    renderCalendar() {
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        
        let html = `
            <div class="date-range-header">
                <button class="date-range-nav-btn" data-action="prev">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 18l-6-6 6-6"/>
                    </svg>
                </button>
                <div class="date-range-month-year">${monthNames[month]} ${year}</div>
                <button class="date-range-nav-btn" data-action="next">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </button>
            </div>
            <div class="date-range-weekdays">
                ${dayNames.map(day => `<div class="date-range-weekday">${day}</div>`).join('')}
            </div>
            <div class="date-range-days">
        `;
        
        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            html += '<div class="date-range-day empty"></div>';
        }
        
        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = this.formatDate(date);
            const isStart = this.startDate && this.formatDate(this.startDate) === dateStr;
            const isEnd = this.endDate && this.formatDate(this.endDate) === dateStr;
            const isInRange = this.isDateInRange(date);
            const isToday = this.isToday(date);
            
            let classes = 'date-range-day';
            if (isStart) classes += ' start';
            if (isEnd) classes += ' end';
            if (isInRange && !isStart && !isEnd) classes += ' in-range';
            if (isToday) classes += ' today';
            
            html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
        }
        
        html += `
            </div>
            <div class="date-range-footer">
                <button class="date-range-btn cancel" data-action="cancel">Cancel</button>
                <button class="date-range-btn apply" data-action="apply">Apply</button>
            </div>
        `;
        
        this.calendar.innerHTML = html;
        
        // Attach event listeners to new elements
        this.attachCalendarEvents();
    }
    
    attachCalendarEvents() {
        // Navigation buttons
        this.calendar.querySelectorAll('[data-action="prev"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
                this.renderCalendar();
            });
        });
        
        this.calendar.querySelectorAll('[data-action="next"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
                this.renderCalendar();
            });
        });
        
        // Day clicks
        this.calendar.querySelectorAll('.date-range-day[data-date]').forEach(day => {
            day.addEventListener('click', (e) => {
                e.stopPropagation();
                const dateStr = e.target.getAttribute('data-date');
                this.selectDate(dateStr);
            });
        });
        
        // Footer buttons
        this.calendar.querySelectorAll('[data-action="cancel"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cancel();
            });
        });
        
        this.calendar.querySelectorAll('[data-action="apply"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.apply();
            });
        });
        
        // Prevent clicks inside calendar from closing it
        this.calendar.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
    
    selectDate(dateStr) {
        const date = new Date(dateStr + 'T00:00:00');
        
        if (!this.startDate || (this.startDate && this.endDate)) {
            // Start new selection
            this.startDate = date;
            this.endDate = null;
        } else if (date < this.startDate) {
            // Selected date is before start, make it the new start
            this.endDate = this.startDate;
            this.startDate = date;
        } else {
            // Selected date is after start, make it the end
            this.endDate = date;
        }
        
        this.renderCalendar();
    }
    
    isDateInRange(date) {
        if (!this.startDate || !this.endDate) return false;
        const dateStr = this.formatDate(date);
        const startStr = this.formatDate(this.startDate);
        const endStr = this.formatDate(this.endDate);
        return dateStr >= startStr && dateStr <= endStr;
    }
    
    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    formatDisplayDate(date) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
    }
    
    updateInputDisplay() {
        if (this.startDate && this.endDate) {
            const start = this.formatDisplayDate(this.startDate);
            const end = this.formatDisplayDate(this.endDate);
            this.input.value = `${start} - ${end}`;
        } else if (this.startDate) {
            const start = this.formatDisplayDate(this.startDate);
            this.input.value = `${start} - ${start}`;
        } else {
            this.input.value = '';
        }
    }
    
    attachEvents() {
        // Toggle calendar on input click
        this.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        
        // Close on outside click - use capture phase to ensure it runs after stopPropagation
        this.outsideClickHandler = (e) => {
            if (this.isOpen && 
                !this.calendar.contains(e.target) && 
                e.target !== this.input &&
                !this.input.contains(e.target)) {
                this.close();
            }
        };
        
        document.addEventListener('click', this.outsideClickHandler, true);
    }
    
    destroy() {
        // Clean up event listeners
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler, true);
        }
        if (this.calendar && this.calendar.parentNode) {
            this.calendar.parentNode.removeChild(this.calendar);
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.isOpen = true;
        this.calendar.style.display = 'block';
        this.positionCalendar();
    }
    
    close() {
        this.isOpen = false;
        this.calendar.style.display = 'none';
    }
    
    positionCalendar() {
        const rect = this.input.getBoundingClientRect();
        this.calendar.style.position = 'fixed';
        this.calendar.style.top = `${rect.bottom + 8}px`;
        this.calendar.style.left = `${rect.left}px`;
        this.calendar.style.zIndex = '10000';
    }
    
    apply() {
        if (this.startDate && this.endDate) {
            this.updateInputDisplay();
            this.options.onRangeSelect(this.startDate, this.endDate);
        }
        this.close();
    }
    
    cancel() {
        // Reset to previous selection
        this.close();
    }
    
    clear() {
        this.startDate = null;
        this.endDate = null;
        this.updateInputDisplay();
        this.renderCalendar();
        this.options.onClear();
    }
    
    setRange(startDate, endDate) {
        this.startDate = startDate ? new Date(startDate) : null;
        this.endDate = endDate ? new Date(endDate) : null;
        this.updateInputDisplay();
        this.renderCalendar();
    }
    
    getRange() {
        return {
            start: this.startDate,
            end: this.endDate
        };
    }
}

