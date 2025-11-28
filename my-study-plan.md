---
layout: page
title: My Study Plan
---

<div id="debug-info" style="background: #f0f0f0; padding: 20px; margin: 20px 0; border-radius: 10px;">
  <h3>Debug Information:</h3>
  <div id="status">Checking Memberspace...</div>
</div>

<div id="study-content">
  <p>Loading your personal study plan...</p>
</div>

<script>
console.log('Script started...');

// Check if Memberspace is loaded
if (typeof window.MemberSpace !== 'undefined') {
  console.log('MemberSpace object exists');
  document.getElementById('status').innerHTML = 'MemberSpace object found';
} else {
  console.log('MemberSpace object not found');
  document.getElementById('status').innerHTML = 'MemberSpace object NOT found - this is the problem';
}

window.MemberSpace = window.MemberSpace || {};
console.log('MemberSpace ready setup');

window.MemberSpace.ready = function() {
  console.log('MemberSpace.ready triggered!');
  document.getElementById('status').innerHTML += '<br>MemberSpace.ready fired';

  const member = MemberSpace.getCurrentMember();
  console.log('Member object:', member);

  if (member) {
    document.getElementById('status').innerHTML += '<br>Member found: ' + member.name;

    const studyPlan = member.getFieldValue('study_plan');
    console.log('Study plan:', studyPlan);
    document.getElementById('status').innerHTML += '<br>Study plan: ' + (studyPlan ? 'FOUND' : 'NOT FOUND');

    const contentDiv = document.getElementById('study-content');

    if (studyPlan) {
      contentDiv.innerHTML = studyPlan;
      document.getElementById('status').innerHTML += '<br>Content loaded successfully!';
    } else {
      contentDiv.innerHTML = `
        <h1>Welcome, ${member.name}!</h1>
        <p>Your personalized study plan is being prepared. Please check back soon.</p>
        <p><em>Debug: No study_plan field found for this user.</em></p>
      `;
    }
  } else {
    document.getElementById('status').innerHTML += '<br>No member logged in';
    document.getElementById('study-content').innerHTML = '<p>Please log in to see your study plan.</p>';
  }
};

// Fallback in case MemberSpace.ready doesn't fire
setTimeout(function() {
  if (document.getElementById('study-content').innerHTML.includes('Loading')) {
    console.log('Fallback triggered');
    document.getElementById('status').innerHTML += '<br>Fallback: MemberSpace.ready may not have fired';
    document.getElementById('study-content').innerHTML = `
      <p>If you can see this, there might be a JavaScript issue.</p>
      <p>Please check the browser console for errors (F12 → Console).</p>
    `;
  }
}, 3000);
</script>
