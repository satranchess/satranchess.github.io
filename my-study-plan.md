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
    // Get the student's name (you'll set this in Memberspace)
    const studentName = member.name;

    // Show personalized content based on who's logged in
    const contentDiv = document.getElementById('study-content');

    if (studentName === 'Ali') {
      contentDiv.innerHTML = `
        <h1>🏆 Welcome, Ali!</h1>
        <p>This content is ONLY for Ali. Other students cannot see this.</p>

        <h2>Your Weekly Plan:</h2>
        <ul>
          <li>Practice knight forks</li>
          <li>Study Italian Opening</li>
          <li>Complete 10 puzzles daily</li>
        </ul>
      `;
    }
    else if (studentName === 'Ayşe') {
      contentDiv.innerHTML = `
        <h1>🌟 Welcome, Ayşe!</h1>
        <p>This content is ONLY for Ayşe. Other students cannot see this.</p>

        <h2>Your Weekly Plan:</h2>
        <ul>
          <li>Practice king and pawn endgames</li>
          <li>Review the London System</li>
          <li>Analyze 2 master games</li>
        </ul>
      `;
    }
    else {
      contentDiv.innerHTML = `
        <h1>Welcome!</h1>
        <p>Your study plan is being prepared. Please check back later.</p>
      `;
    }
  }
}
</script>
