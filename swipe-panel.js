// Swipe-up panel functionality for mobile
(function() {
    const sidePanel = document.getElementById('side-panel');
    const panelHandle = document.getElementById('panel-handle');
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let isExpanded = false;
    const panelMaxHeight = window.innerHeight * 0.7;
    
    // Only enable on mobile
    const isMobile = () => window.matchMedia('(max-width: 900px), (max-height: 620px)').matches;
    
    function handleTouchStart(e) {
        if (!isMobile()) return;
        startY = e.touches[0].clientY;
        isDragging = true;
    }
    
    function handleTouchMove(e) {
        if (!isDragging || !isMobile()) return;
        currentY = e.touches[0].clientY;
        const delta = startY - currentY;
        
        if (isExpanded) {
            // Allow dragging down to collapse
            const newTranslate = Math.max(delta - 50, -panelMaxHeight);
            sidePanel.style.transform = `translateY(${-newTranslate}px)`;
        } else {
            // Allow dragging up to expand
            const newTranslate = Math.min(delta, 50);
            sidePanel.style.transform = `translateY(calc(100% - ${50 - newTranslate}px))`;
        }
    }
    
    function handleTouchEnd(e) {
        if (!isDragging || !isMobile()) return;
        isDragging = false;
        
        const delta = startY - currentY;
        const threshold = 30;
        
        if (Math.abs(delta) > threshold) {
            if (delta > 0 && !isExpanded) {
                // Swiped up
                expandPanel();
            } else if (delta < 0 && isExpanded) {
                // Swiped down
                collapsePanel();
            } else {
                // Snap back
                resetPanel();
            }
        } else {
            resetPanel();
        }
    }
    
    function expandPanel() {
        isExpanded = true;
        sidePanel.classList.add('panel-expanded');
        sidePanel.style.transform = 'translateY(0)';
    }
    
    function collapsePanel() {
        isExpanded = false;
        sidePanel.classList.remove('panel-expanded');
        sidePanel.style.transform = 'translateY(calc(100% - 50px))';
    }
    
    function resetPanel() {
        if (isExpanded) {
            sidePanel.style.transform = 'translateY(0)';
        } else {
            sidePanel.style.transform = 'translateY(calc(100% - 50px))';
        }
    }
    
    // Toggle on handle click
    if (panelHandle) {
        panelHandle.addEventListener('click', function(e) {
            if (!isMobile()) return;
            e.preventDefault();
            if (isExpanded) {
                collapsePanel();
            } else {
                expandPanel();
            }
        });
    }
    
    // Add touch listeners
    sidePanel.addEventListener('touchstart', handleTouchStart, false);
    sidePanel.addEventListener('touchmove', handleTouchMove, false);
    sidePanel.addEventListener('touchend', handleTouchEnd, false);
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (!isMobile() && isExpanded) {
            // If returning to desktop, reset
            isExpanded = false;
            sidePanel.classList.remove('panel-expanded');
            sidePanel.style.transform = '';
        }
    });
})();
