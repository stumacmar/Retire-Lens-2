// Quick test script - fill form and calculate
async function quickTest() {
  const inputs = [
    { field: 'input-current-age', value: '45' },
    { field: 'input-retirement-age', value: '65' },
    { field: 'input-target-income', value: '30000' },
    { field: 'input-pension-pot', value: '250000' },
    { field: 'input-pension-contribution', value: '800' }
  ];
  
  // Fill inputs
  inputs.forEach(inp => {
    const el = document.getElementById(inp.field);
    if (el) el.value = inp.value;
  });
  
  // Uncheck unnecessary options
  document.getElementById('enable-benchmarking').checked = false;
  document.getElementById('enable-tax-optimization').checked = false;
  document.getElementById('model-care-costs').checked = false;
  
  // Click Calculate
  const btn = document.querySelector('button[type="button"]');
  if (btn && btn.textContent.includes('Calculate')) {
    btn.click();
  }
}

// Wait for page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', quickTest);
} else {
  setTimeout(quickTest, 500);
}
