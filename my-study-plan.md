---
layout: page
title: My Study Plan
---

<div id="study-content">
  <p>Testing basic functionality...</p>
</div>

<script>
console.log('Simple test started');
setTimeout(function() {
  const member = window.MemberSpace ? window.MemberSpace.getCurrentMember() : null;

  if (member && member.name) {
    if (member.name === 'Ali') {
      document.getElementById('study-content').innerHTML = '<h1>Hello Ali! This is YOUR private page.</h1>';
    } else if (member.name === 'Ayşe') {
      document.getElementById('study-content').innerHTML = '<h1>Hello Ayşe! This is YOUR private page.</h1>';
    } else {
      document.getElementById('study-content').innerHTML = '<h1>Hello ' + member.name + '! Welcome to your study plan.</h1>';
    }
  } else {
    document.getElementById('study-content').innerHTML = '<p>No member detected or not logged in.</p>';
  }
}, 1000);
</script>
