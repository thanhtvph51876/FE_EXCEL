function selectPriority(btn, val) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.priority-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(255,255,255,0.1)';
        b.style.color = 'var(--color-text-muted)';
        b.style.fontWeight = '400';
    });

    if (val === 'Trung bình') {
        btn.style.background = 'rgba(59, 130, 246, 0.1)';
        btn.style.borderColor = '#3b82f6';
        btn.style.color = '#fff';
        btn.style.fontWeight = '600';
    } else if (val === 'Cao') {
        btn.style.background = 'rgba(245, 158, 11, 0.1)';
        btn.style.borderColor = '#f59e0b';
        btn.style.color = '#fff';
        btn.style.fontWeight = '600';
    } else {
        btn.style.background = 'rgba(239, 68, 68, 0.1)';
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#fff';
        btn.style.fontWeight = '600';
    }

    const select = document.getElementById('broadcast-priority-select');
    if (select) {
        select.value = val;
        select.dispatchEvent(new Event('change'));
    }
}

function selectTarget(btn, val) {
    const parent = btn.parentElement;
    parent.querySelectorAll('.target-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(255,255,255,0.1)';
        b.style.color = 'var(--color-text-muted)';
        b.style.fontWeight = '400';
    });
    btn.style.background = 'rgba(59, 130, 246, 0.1)';
    btn.style.borderColor = '#3b82f6';
    btn.style.color = '#fff';
    btn.style.fontWeight = '600';

    const select = document.getElementById('broadcast-target-select');
    if (select) {
        select.value = val;
        select.dispatchEvent(new Event('change'));
    }
}

window.selectPriority = selectPriority;
window.selectTarget = selectTarget;
