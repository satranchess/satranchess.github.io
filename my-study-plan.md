---
layout: page
title: My Study Plan
---

layout: page
title: My Study Plan
---

<div id="study-content">
  <p>Loading your personal study plan...</p>
</div>

<script>
window.MemberSpace = window.MemberSpace || {};
window.MemberSpace.ready = function() {
  const member = MemberSpace.getCurrentMember();

  if (member) {
    const studyPlan = member.getFieldValue('study_plan');
    const contentDiv = document.getElementById('study-content');

    if (studyPlan) {
      contentDiv.innerHTML = studyPlan;
    } else {
      contentDiv.innerHTML = `
        <h1>Welcome, ${member.name}!</h1>
        <p>Your personalized study plan is being prepared. Please check back soon.</p>
      `;
    }
  }
}
</script>
