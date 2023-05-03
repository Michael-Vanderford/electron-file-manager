## Conventions

- 모든 작업내용은 Issue로 작성한 뒤, Branch를 분리해 작업하고, PR을 통해 Code-Review 이후 Master Branch에 Merge 합니다.

---

### Commit Rule
```
__Action__ __FileName__ : __Description__
```
- Action 은 다음과 같이 두가지 종류로 구분됩니다.
    - Added : 새로운 파일을 추가한 경우
    - Update : 특정 파일을 수정한 경우
- FileName 은 추가 혹은 수정한 파일의 이름을 의미합니다.
    - Dependency, Gitignore과 같이 프로젝트 전역의 설정 파일을 수정한 경우에는 ```Update Project```와 같이 작성합니다.
- Description 은 Commit에서 변경된 내용을 한 문장으로 요약합니다.

#### Commit Example
```
Added README.md
```
```
Update main.js : Added Button for Refresh
```
```
Update Project : Added Electron NPM Package
```

---

### Branch Rule
```
TYPE/BRANCH_NAME
```
- 기본적으로 Branch의 이름은 Issue의 이름을 따릅니다.
- TYPE은 다음 중 하나를 해당하는 Issue의 Type과 동일하게 선택합니다.
  - dev : 일반적인 개발 사항
  - fix : 기존에 개발된 내용을 수정하는 사항
  - doc : README, Rules 등 문서에 관련된 사항
- BRANCH_NAME은 해당하는 Issue의 Title을 적절히 변형합니다.

#### Branch Example
```
dev/base-layout
```
```
fix/file-rename-feature
```
```
doc/convention-documentation
```

---

### Issue / PR Rule

#### Title
```
[TYPE] TITLE
```
- TYPE 은 다음 중 하나를 선택합니다.
  - DEV : 일반적인 개발 사항
  - FIX : 기존에 개발된 내용을 수정하는 사항
  - DOC : README 등 문서에 관련된 사항

####  Content
```markdown
## Summary
Summary of Issue or PR

## Description
Detail Description of Issue or PR
```
- Description 항목이 불필요한 경우에는 생략할 수 있습니다.
- FIX Issue 혹은 UI에 관련된 PR의 경우는, Description에 스크린샷을 첨부해주시기 바랍니다.
- Issue 작성 시, Assignee와 Label을 지정하고, 생성한 Branch를 Development 항목에 지정해줍니다.
- PR 작성 시, Assignee와 Label을 지정하고, Reviewer을 상호로 지정하고, 해당하는 Issue를 Development 항목에 지정해줍니다.
- PR 작성 시, Reviewer 항목에는 자기 자신을 제외한 3명의 팀원을 지정합니다. Reviewer로 지정된 각 팀원은 PR에 포함된 코드를 읽고,
문제가 있어보이거나 의문이 드는 코드에 대해 코멘트를 남겨주세요. 완벽해 보인다면 Approve 코멘트를 남깁니다.
3명 모두 Approve가 완료되었다면 PR을 작성한 팀원이 직접 Merge 합니다.