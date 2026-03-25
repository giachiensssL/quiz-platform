$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5001/api'
$rows = @()

function Add-Row {
  param([string]$Step,[string]$Name,[bool]$Ok,[string]$Detail)
  $script:rows += [pscustomobject]@{ Step=$Step; Name=$Name; Status=$(if($Ok){'PASS'}else{'FAIL'}); Detail=$Detail }
}

function Try-Step {
  param([string]$Step,[string]$Name,[scriptblock]$Action)
  try { & $Action } catch { Add-Row -Step $Step -Name $Name -Ok $false -Detail $_.Exception.Message }
}

function Normalize-List {
  param($Data)
  if ($null -eq $Data) { return @() }
  if ($Data -is [System.Array]) { return @($Data) }
  $valueProp = $Data.PSObject.Properties['value']
  if ($valueProp -and $valueProp.Value -is [System.Collections.IEnumerable] -and -not ($valueProp.Value -is [string])) {
    return @($valueProp.Value)
  }
  return @($Data)
}

function Normalize-Id {
  param($RawId)
  $text = [string]$RawId
  if ([string]::IsNullOrWhiteSpace($text)) { return '' }

  $compact = ($text -replace '[^a-fA-F0-9]', '')
  if ($compact.Length -ge 24) {
    return $compact.Substring(0, 24).ToLower()
  }

  $parts = ($text -split '\s+') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  if ($parts.Count -ge 1) { return [string]$parts[0] }
  return ''
}

function Get-EntityId {
  param($Entity)
  if ($null -eq $Entity) { return '' }
  $id1 = Normalize-Id $Entity._id
  if ($id1) { return $id1 }
  $id2 = Normalize-Id $Entity.id
  if ($id2) { return $id2 }
  return ''
}

$adminHeaders = @{}
$userHeaders = @{}
$tempUserId = ''
$tempUsername = 'manual_e2e_' + (Get-Date -Format 'HHmmss')
$tempPassword = 'E2E@12345'

$adminFaculties = @()
$adminYears = @()
$adminSemesters = @()

$faculties = @()
$subjects = @()
$allLessons = @()
$firstLesson = $null
$secondLesson = $null
$quizQuestions = @()

$seedSubjectId = ''
$seedLessonId = ''
$seedQuestionIds = @()

Try-Step '01' 'Frontend ready' { $r=Invoke-WebRequest -UseBasicParsing 'http://localhost:3000' -TimeoutSec 12; Add-Row '01' 'Frontend ready' ($r.StatusCode -eq 200) "HTTP=$($r.StatusCode)" }
Try-Step '02' 'Backend ping' { $r=Invoke-RestMethod "$base/ping" -TimeoutSec 10; Add-Row '02' 'Backend ping' ($r.status -eq 'ok') "status=$($r.status)" }
Try-Step '03' 'Admin login' { $r=Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{ username='Janscient125'; password='Janscient2005' } | ConvertTo-Json); $script:adminHeaders=@{ Authorization = "Bearer $($r.token)" }; Add-Row '03' 'Admin login' (($r.role -eq 'admin') -and -not [string]::IsNullOrWhiteSpace($r.token)) "role=$($r.role)" }
Try-Step '04' 'Admin load faculties' {
  $script:adminFaculties = Normalize-List (Invoke-RestMethod -Uri "$base/admin/faculties" -Headers $script:adminHeaders)
  $script:faculties = Normalize-List (Invoke-RestMethod -Uri "$base/faculties" -Headers $script:adminHeaders)
  Add-Row '04' 'Admin load faculties' ($script:adminFaculties.Count -ge 1) "count=$($script:adminFaculties.Count)"
}
Try-Step '05' 'Admin load years' {
  $script:adminYears = Normalize-List (Invoke-RestMethod -Uri "$base/admin/years" -Headers $script:adminHeaders)
  Add-Row '05' 'Admin load years' ($script:adminYears.Count -ge 1) "count=$($script:adminYears.Count)"
}
Try-Step '06' 'Admin load semesters' {
  $script:adminSemesters = Normalize-List (Invoke-RestMethod -Uri "$base/admin/semesters" -Headers $script:adminHeaders)
  Add-Row '06' 'Admin load semesters' ($script:adminSemesters.Count -ge 1) "count=$($script:adminSemesters.Count)"
}
Try-Step '07' 'Admin load subjects' {
  $script:subjects = Normalize-List (Invoke-RestMethod -Uri "$base/subjects" -Headers $script:adminHeaders)
  Add-Row '07' 'Admin load subjects' ($script:subjects.Count -ge 1) "count=$($script:subjects.Count)"
}
Try-Step '08' 'Admin load lessons for subjects' {
  $script:allLessons=@()
  foreach($subject in $script:subjects){
    $subjectId = Get-EntityId $subject
    if(-not $subjectId){ continue }
    try{
      $ls = Normalize-List (Invoke-RestMethod -Uri "$base/lessons/$subjectId" -Headers $script:adminHeaders)
      if($ls.Count -gt 0){ $script:allLessons += $ls }
    } catch {}
  }
  $seeded = $false
  $facultyId = if($script:adminFaculties.Count -gt 0){ Get-EntityId $script:adminFaculties[0] } else { '' }
  $yearId = if($script:adminYears.Count -gt 0){ Get-EntityId $script:adminYears[0] } else { '' }
  $semesterId = if($script:adminSemesters.Count -gt 0){ Get-EntityId $script:adminSemesters[0] } else { '' }

  if(-not ($facultyId -and $yearId -and $semesterId)){
    throw 'Cannot seed checklist data because faculty/year/semester is missing'
  }

  $suffix = Get-Date -Format 'yyyyMMddHHmmss'
  $subjectBody = @{ name = "E2E Temp Subject $suffix"; description = 'Auto seeded for checklist'; faculty = $facultyId; year = $yearId; semester = $semesterId; code = "E2E$suffix" }
  $createdSubject = Invoke-RestMethod -Uri "$base/admin/subjects" -Method Post -Headers $script:adminHeaders -ContentType 'application/json' -Body ($subjectBody | ConvertTo-Json -Depth 8)
  $script:seedSubjectId = Get-EntityId $createdSubject

  $lessonBody = @{ subject = $script:seedSubjectId; title = "E2E Temp Lesson $suffix"; description = 'Auto seeded for checklist'; order = 1 }
  $createdLesson = Invoke-RestMethod -Uri "$base/admin/lessons" -Method Post -Headers $script:adminHeaders -ContentType 'application/json' -Body ($lessonBody | ConvertTo-Json -Depth 8)
  $script:seedLessonId = Get-EntityId $createdLesson

  $q1Body = @{ lessonId = $script:seedLessonId; type = 'single'; question = 'E2E single choice question'; answers = @(@{ text='Option A'; isCorrect=$true }, @{ text='Option B'; isCorrect=$false }); points = 1; order = 1 }
  $q1 = Invoke-RestMethod -Uri "$base/admin/questions" -Method Post -Headers $script:adminHeaders -ContentType 'application/json' -Body ($q1Body | ConvertTo-Json -Depth 8)
  $q2Body = @{ lessonId = $script:seedLessonId; type = 'multiple'; question = 'E2E multiple choice question'; answers = @(@{ text='Option A'; isCorrect=$true }, @{ text='Option B'; isCorrect=$true }, @{ text='Option C'; isCorrect=$false }); points = 1; order = 2 }
  $q2 = Invoke-RestMethod -Uri "$base/admin/questions" -Method Post -Headers $script:adminHeaders -ContentType 'application/json' -Body ($q2Body | ConvertTo-Json -Depth 8)
  $script:seedQuestionIds = @((Get-EntityId $q1), (Get-EntityId $q2)) | Where-Object { $_ }

  $script:subjects = Normalize-List (Invoke-RestMethod -Uri "$base/subjects" -Headers $script:adminHeaders)
  if($script:seedLessonId){
    $script:allLessons += @($createdLesson)
    $seeded = $true
  }

  if(-not $seeded){
    throw 'Seed lesson was not created correctly'
  }
  if($script:allLessons.Count -gt 0){
    $seedLessonObj = $script:allLessons | Where-Object { (Get-EntityId $_) -eq $script:seedLessonId } | Select-Object -First 1
    if($seedLessonObj){
      $script:firstLesson=$seedLessonObj
    } else {
      $script:firstLesson=$script:allLessons[0]
    }
  }
  if($script:allLessons.Count -gt 1){ $script:secondLesson=$script:allLessons[1] }
  Add-Row '08' 'Admin load lessons for subjects' ($script:allLessons.Count -ge 1) "lessons=$($script:allLessons.Count); seeded=$seeded"
}
Try-Step '09' 'Admin create temp user' {
  $created=Invoke-RestMethod -Uri "$base/admin/create-user" -Method Post -Headers $script:adminHeaders -ContentType 'application/json' -Body (@{ username=$script:tempUsername; password=$script:tempPassword; role='user'; fullName='Manual E2E'; email="$($script:tempUsername)@example.com" } | ConvertTo-Json)
  $script:tempUserId = if($created._id){$created._id}else{$created.id}
  Add-Row '09' 'Admin create temp user' (-not [string]::IsNullOrWhiteSpace($script:tempUserId)) "user=$($script:tempUsername)"
}
Try-Step '10' 'User login' { $u=Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{ username=$script:tempUsername; password=$script:tempPassword } | ConvertTo-Json); $script:userHeaders=@{ Authorization = "Bearer $($u.token)" }; Add-Row '10' 'User login' (($u.role -eq 'user') -and -not [string]::IsNullOrWhiteSpace($u.token)) "role=$($u.role)" }
Try-Step '11' 'User load faculties' { $r=Normalize-List (Invoke-RestMethod -Uri "$base/faculties" -Headers $script:userHeaders); Add-Row '11' 'User load faculties' ($r.Count -ge 1) "count=$($r.Count)" }
Try-Step '12' 'User load years' { $r=Normalize-List (Invoke-RestMethod -Uri "$base/years" -Headers $script:userHeaders); Add-Row '12' 'User load years' ($r.Count -ge 1) "count=$($r.Count)" }
Try-Step '13' 'User load semesters' { $r=Normalize-List (Invoke-RestMethod -Uri "$base/semesters" -Headers $script:userHeaders); Add-Row '13' 'User load semesters' ($r.Count -ge 1) "count=$($r.Count)" }
Try-Step '14' 'User load subjects' { $r=Normalize-List (Invoke-RestMethod -Uri "$base/subjects" -Headers $script:userHeaders); Add-Row '14' 'User load subjects' ($r.Count -ge 1) "count=$($r.Count)" }
Try-Step '15' 'User open quiz lesson' {
  $candidates = @()
  if($script:seedLessonId){
    $seedLessonObj = $script:allLessons | Where-Object { (Get-EntityId $_) -eq $script:seedLessonId } | Select-Object -First 1
    if($seedLessonObj){ $candidates += $seedLessonObj }
  }
  if($script:secondLesson){ $candidates += $script:secondLesson }
  if($script:firstLesson){ $candidates += $script:firstLesson }
  $candidates += $script:allLessons

  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  $errors = @()
  $picked = $null

  foreach($lesson in $candidates){
    $lessonId = Get-EntityId $lesson
    if(-not $lessonId){ continue }
    if($seen.Contains($lessonId)){ continue }
    [void]$seen.Add($lessonId)
    try {
      $qs = Normalize-List (Invoke-RestMethod -Uri "$base/questions/$($lessonId)?limit=5" -Headers $script:userHeaders)
      if($qs.Count -ge 1){
        $script:quizLesson = $lesson
        $script:quizQuestions = $qs
        $picked = $lesson
        break
      }
    } catch {
      $errors += $_.Exception.Message
    }
  }

  if(-not $picked){
    if($errors.Count -gt 0){ throw ($errors | Select-Object -First 1) }
    throw 'No lesson found for quiz test'
  }

  Add-Row '15' 'User open quiz lesson' ($script:quizQuestions.Count -ge 1) "lesson=$($picked.title), questions=$($script:quizQuestions.Count)"
}
Try-Step '16' 'User submit quiz' {
  $answers=@()
  foreach($q in $script:quizQuestions){
    $item=@{ questionId=[string]$q._id; answer='' }
    $qType=[string]$q.type
    if($qType -eq 'single' -or $qType -eq 'true_false'){
      $correct=$q.answers | Where-Object { $_.isCorrect } | Select-Object -First 1
      if($correct){ $item.answer=[string]$correct._id }
    } elseif($qType -eq 'multiple'){
      $ids=@($q.answers | Where-Object { $_.isCorrect } | ForEach-Object { [string]$_.id })
      if($ids.Count -gt 0){ $item.answer=$ids }
    } elseif($qType -eq 'fill'){
      $correct=$q.answers | Where-Object { $_.isCorrect } | Select-Object -First 1
      if($correct){ $item.answer=[string]$correct.text }
    } elseif($qType -eq 'drag_drop'){
      $map=@{}
      foreach($target in @($q.dropTargets)){ if($target.correctItemIds){ $map[$target.id]=@($target.correctItemIds) } elseif($target.correctItemId){ $map[$target.id]=@($target.correctItemId) } }
      $item.answer=$map
    }
    $answers += $item
  }
  $result=Invoke-RestMethod -Uri "$base/submit" -Method Post -Headers $script:userHeaders -ContentType 'application/json' -Body (@{ lessonId=(Get-EntityId $script:quizLesson); answers=$answers; timeSpent=120 } | ConvertTo-Json -Depth 8)
  Add-Row '16' 'User submit quiz' ($result.total -ge 1) "score=$($result.score)/$($result.total)"
}
Try-Step '17' 'Leaderboard contains user attempt' { $lb=Normalize-List (Invoke-RestMethod -Uri "$base/leaderboard?period=all"); $mine=@($lb | Where-Object { $_.username -eq $script:tempUsername }); Add-Row '17' 'Leaderboard contains user attempt' ($mine.Count -ge 1) "found=$($mine.Count)" }
Try-Step '18' 'Admin set user access locks' {
  $lockFacultyId = if($script:faculties.Count -gt 0){ Get-EntityId $script:faculties[0] } else { '' }
  $lockLessonId = if($script:firstLesson){ Get-EntityId $script:firstLesson } else { '' }
  $script:lockFacultyId = $lockFacultyId
  $script:lockLessonId = $lockLessonId
  $body=@{ accessLocks=@{ faculties=@(); years=@(); semesters=@(); subjects=@(); lessons=@() } }
  if($lockFacultyId){ $body.accessLocks.faculties=@($lockFacultyId) }
  if($lockLessonId){ $body.accessLocks.lessons=@($lockLessonId) }
  Invoke-RestMethod -Uri "$base/admin/users/$($script:tempUserId)/access-locks" -Method Patch -Headers $script:adminHeaders -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 8) | Out-Null
  Add-Row '18' 'Admin set user access locks' $true "faculty=$lockFacultyId lesson=$lockLessonId"
}
Try-Step '19' 'Locked faculty hidden for user' {
  $r=Normalize-List (Invoke-RestMethod -Uri "$base/faculties" -Headers $script:userHeaders)
  $visible=@($r | Where-Object {
    $id1 = Normalize-Id $_.id
    $id2 = Normalize-Id $($_.PSObject.Properties['_id'].Value)
    $id1 -eq $script:lockFacultyId -or $id2 -eq $script:lockFacultyId
  }).Count
  Add-Row '19' 'Locked faculty hidden for user' ($visible -eq 0) "visible=$visible"
}
Try-Step '20' 'Locked lesson blocked for user' {
  if(-not $script:lockLessonId){ throw 'No lesson available for lock test' }
  try { Invoke-RestMethod -Uri "$base/questions/$($script:lockLessonId)" -Headers $script:userHeaders -ErrorAction Stop | Out-Null; Add-Row '20' 'Locked lesson blocked for user' $false 'Expected 403 but got success' }
  catch { $msg=$_.ErrorDetails.Message; $ok=($_.Exception.Message -match '403') -or ($msg -match 'khoa|khóa'); Add-Row '20' 'Locked lesson blocked for user' $ok $msg }
}
Try-Step '21' 'Admin invalid subject guard' {
  $msg=''; $ex='';
  try {
    Invoke-RestMethod -Uri "$base/admin/subjects/10001" -Method Delete -Headers $script:adminHeaders -ErrorAction Stop | Out-Null
    $msg='unexpected-success'
  } catch {
    $msg=$_.ErrorDetails.Message
    $ex=$_.Exception.Message
  }
  $parsedMessage = ''
  try { $parsedMessage = [string]((ConvertFrom-Json $msg).message) } catch {}
  $combined = "$msg $parsedMessage $ex"
  $ok = (($combined -match '400') -and ($combined -match 'ID|subject|môn học|mon hoc')) -or ($combined -match 'ID môn học không hợp lệ|ID mon hoc khong hop le')
  Add-Row '21' 'Admin invalid subject guard' $ok $msg
}
Try-Step '22' 'Admin users list' { $users=Normalize-List (Invoke-RestMethod -Uri "$base/admin/users" -Headers $script:adminHeaders); Add-Row '22' 'Admin users list' ($users.Count -ge 1) "count=$($users.Count)" }
Try-Step '23' 'User token invalid after logout' {
  Invoke-RestMethod -Uri "$base/auth/logout" -Method Post -Headers $script:userHeaders | Out-Null
  try { Invoke-RestMethod -Uri "$base/faculties" -Headers $script:userHeaders -ErrorAction Stop | Out-Null; Add-Row '23' 'User token invalid after logout' $false 'Expected 401 but got success' }
  catch { $msg=$_.ErrorDetails.Message; $ok=($_.Exception.Message -match '401') -or ($msg -match 'Invalid or expired token|dang nhap o thiet bi khac'); Add-Row '23' 'User token invalid after logout' $ok $msg }
}
Try-Step '24' 'Admin token invalid after logout' {
  Invoke-RestMethod -Uri "$base/auth/logout" -Method Post -Headers $script:adminHeaders | Out-Null
  try { Invoke-RestMethod -Uri "$base/admin/users" -Headers $script:adminHeaders -ErrorAction Stop | Out-Null; Add-Row '24' 'Admin token invalid after logout' $false 'Expected 401 but got success' }
  catch { $msg=$_.ErrorDetails.Message; $ok=($_.Exception.Message -match '401') -or ($msg -match 'Invalid or expired token|dang nhap o thiet bi khac'); Add-Row '24' 'Admin token invalid after logout' $ok $msg }
}
Try-Step '25' 'Cleanup temp user' {
  $relogin=Invoke-RestMethod -Uri "$base/auth/login" -Method Post -ContentType 'application/json' -Body (@{ username='Janscient125'; password='Janscient2005' } | ConvertTo-Json)
  $headers=@{ Authorization = "Bearer $($relogin.token)" }
  if($script:seedQuestionIds.Count -gt 0){
    foreach($qid in $script:seedQuestionIds){
      if($qid){ try { Invoke-RestMethod -Uri "$base/admin/questions/$qid" -Method Delete -Headers $headers | Out-Null } catch {} }
    }
  }
  if($script:seedLessonId){
    try { Invoke-RestMethod -Uri "$base/admin/lessons/$($script:seedLessonId)" -Method Delete -Headers $headers | Out-Null } catch {}
  }
  if($script:seedSubjectId){
    try { Invoke-RestMethod -Uri "$base/admin/subjects/$($script:seedSubjectId)" -Method Delete -Headers $headers | Out-Null } catch {}
  }
  Invoke-RestMethod -Uri "$base/admin/users/$($script:tempUserId)" -Method Delete -Headers $headers | Out-Null
  Add-Row '25' 'Cleanup temp user' $true "user=$($script:tempUsername); seedSubject=$($script:seedSubjectId)"
}

$rows | Format-Table -AutoSize | Out-String -Width 500
