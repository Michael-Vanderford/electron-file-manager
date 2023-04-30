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