import * as React from 'react'
import * as Path from 'path'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { IStashEntry, StashedChangesLoadStates } from '../../models/stash-entry'
import {
  CommittedFileChange,
  WorkingDirectoryFileChange,
  AppFileStatusKind,
} from '../../models/status'
import { List } from '../lib/list'
import { StashedFileItem } from './stashed-file-item'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { TextBox } from '../lib/text-box'
import { StashedFilesFilterOptions } from './stashed-files-filter-options'
import { arrayEquals } from '../../lib/equality'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import {
  CopyFilePathLabel,
  CopyRelativeFilePathLabel,
  DefaultEditorLabel,
  OpenWithDefaultProgramLabel,
  isSafeFileExtension,
} from '../lib/context-menu'
import { revealInFileManager } from '../../lib/app-shell'
import { openFile } from '../lib/open-file'
import { clipboard } from 'electron'

const RowHeight = 29

interface IStashedFilesListProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly stashEntry: IStashEntry
  readonly selectedFileIDs: ReadonlyArray<string>
  readonly onFileSelectionChanged: (file: CommittedFileChange | null) => void
  readonly onIncludeChanged: (
    file: CommittedFileChange,
    include: boolean
  ) => void
  readonly onIncludedFilesChanged?: (fileIds: ReadonlyArray<string>) => void
  readonly availableWidth: number
  readonly workingDirectoryFiles: ReadonlyArray<WorkingDirectoryFileChange>
}

interface IStashedFilesListState {
  readonly selectedRows: ReadonlyArray<number>
  readonly focusedRow: number | null
  readonly filterText: string
  readonly filterNewFiles: boolean
  readonly filterModifiedFiles: boolean
  readonly filterDeletedFiles: boolean
  readonly includedFileIds: ReadonlyArray<string>
}

export class StashedFilesList extends React.Component<
  IStashedFilesListProps,
  IStashedFilesListState
> {
  public constructor(props: IStashedFilesListProps) {
    super(props)

    const initialIncludedFileIds =
      props.stashEntry.files.kind === StashedChangesLoadStates.Loaded
        ? props.stashEntry.files.files.map(file => file.id)
        : []

    const initialFilterState = {
      filterText: '',
      filterNewFiles: false,
      filterModifiedFiles: false,
      filterDeletedFiles: false,
    }

    this.state = {
      selectedRows: this.getSelectedRowsFromProps(props, initialFilterState),
      focusedRow: null,
      ...initialFilterState,
      includedFileIds: initialIncludedFileIds,
    }
  }

  public componentDidMount() {
    if (this.state.includedFileIds.length > 0) {
      this.props.onIncludedFilesChanged?.(this.state.includedFileIds)
    }
  }

  public componentDidUpdate(
    prevProps: IStashedFilesListProps,
    prevState: IStashedFilesListState
  ) {
    if (
      !arrayEquals(prevProps.selectedFileIDs, this.props.selectedFileIDs) ||
      prevProps.stashEntry.files !== this.props.stashEntry.files ||
      prevProps.stashEntry.stashSha !== this.props.stashEntry.stashSha ||
      prevProps.workingDirectoryFiles !== this.props.workingDirectoryFiles ||
      prevState.filterText !== this.state.filterText ||
      prevState.filterNewFiles !== this.state.filterNewFiles ||
      prevState.filterModifiedFiles !== this.state.filterModifiedFiles ||
      prevState.filterDeletedFiles !== this.state.filterDeletedFiles
    ) {
      const selectedRows = this.getSelectedRowsFromProps(this.props, this.state)
      if (!arrayEquals(selectedRows, this.state.selectedRows)) {
        this.setState({ selectedRows })
      }
    }

    if (prevProps.stashEntry.stashSha !== this.props.stashEntry.stashSha) {
      this.resetIncludedFiles()
    }

    if (
      prevProps.stashEntry.files.kind !== StashedChangesLoadStates.Loaded &&
      this.props.stashEntry.files.kind === StashedChangesLoadStates.Loaded
    ) {
      this.resetIncludedFiles()
    }
  }

  private resetIncludedFiles() {
    const { stashEntry } = this.props
    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return
    }

    const includedFileIds = stashEntry.files.files.map(file => file.id)

    this.setState({ includedFileIds })
    this.props.onIncludedFilesChanged?.(includedFileIds)
  }

  private onFilterTextChanged = (filterText: string) => {
    this.setState({ filterText })
  }

  private onFilterNewFiles = () => {
    this.setState(prev => ({ filterNewFiles: !prev.filterNewFiles }))
  }

  private onFilterModifiedFiles = () => {
    this.setState(prev => ({ filterModifiedFiles: !prev.filterModifiedFiles }))
  }

  private onFilterDeletedFiles = () => {
    this.setState(prev => ({ filterDeletedFiles: !prev.filterDeletedFiles }))
  }

  private onClearAllFilters = () => {
    this.setState({
      filterNewFiles: false,
      filterModifiedFiles: false,
      filterDeletedFiles: false,
    })
  }

  private onFileSelectionChanged = (rows: ReadonlyArray<number>) => {
    const { stashEntry } = this.props

    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return
    }

    this.setState({ selectedRows: rows })

    // Notify parent of file selection
    if (rows.length > 0) {
      const file = this.getFilteredFiles()[rows[0]]
      this.props.onFileSelectionChanged(file)
    } else {
      this.props.onFileSelectionChanged(null)
    }
  }

  private onIncludeChanged = (file: CommittedFileChange, include: boolean) => {
    const includedFileIds = new Set(this.state.includedFileIds)

    if (include) {
      includedFileIds.add(file.id)
    } else {
      includedFileIds.delete(file.id)
    }

    const updatedIds = Array.from(includedFileIds)

    this.setState({ includedFileIds: updatedIds })
    this.props.onIncludedFilesChanged?.(updatedIds)
    this.props.onIncludeChanged(file, include)
  }

  private onRowFocus = (row: number) => {
    this.setState({ focusedRow: row })
  }

  private onRowBlur = (row: number) => {
    if (this.state.focusedRow === row) {
      this.setState({ focusedRow: null })
    }
  }

  private setIncludedForFile(file: CommittedFileChange, include: boolean) {
    const includedFileIds = new Set(this.state.includedFileIds)

    if (include) {
      includedFileIds.add(file.id)
    } else {
      includedFileIds.delete(file.id)
    }

    const updatedIds = Array.from(includedFileIds)
    this.setState({ includedFileIds: updatedIds })
    this.props.onIncludedFilesChanged?.(updatedIds)
    this.props.onIncludeChanged(file, include)
  }

  private getIncludedFiles(): ReadonlyArray<CommittedFileChange> {
    const { stashEntry } = this.props
    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return []
    }

    const includedIds = new Set(this.state.includedFileIds)
    return stashEntry.files.files.filter(file => includedIds.has(file.id))
  }

  private getContextMenuItems(
    file: CommittedFileChange
  ): ReadonlyArray<IMenuItem> {
    const fullPath = Path.join(this.props.repository.path, file.path)
    const enabled = file.status.kind !== AppFileStatusKind.Deleted
    const extension = Path.extname(file.path)
    const isSafeExtension = isSafeFileExtension(extension)

    const isIncluded = this.state.includedFileIds.includes(file.id)
    const includedFiles = this.getIncludedFiles()
    const actionFiles =
      isIncluded && includedFiles.length > 0 ? includedFiles : [file]

    const items: IMenuItem[] = [
      {
        label: __DARWIN__ ? 'Restore' : 'Restore',
        action: () =>
          this.props.dispatcher.restoreStashFiles(
            this.props.repository,
            this.props.stashEntry,
            actionFiles,
            false
          ),
        enabled: actionFiles.length > 0,
      },
      {
        label: __DARWIN__ ? 'Discard' : 'Discard',
        action: () =>
          this.props.dispatcher.discardStashFiles(
            this.props.repository,
            this.props.stashEntry,
            actionFiles
          ),
        enabled: actionFiles.length > 0,
      },
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Select' : 'Select',
        action: () => this.setIncludedForFile(file, true),
        enabled: !isIncluded,
      },
      {
        label: __DARWIN__ ? 'Deselect' : 'Deselect',
        action: () => this.setIncludedForFile(file, false),
        enabled: isIncluded,
      },
      { type: 'separator' },
      {
        label: CopyFilePathLabel,
        action: () => clipboard.writeText(fullPath),
      },
      {
        label: CopyRelativeFilePathLabel,
        action: () => clipboard.writeText(Path.normalize(file.path)),
      },
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Reveal in Finder' : 'Reveal in File Manager',
        action: () => revealInFileManager(this.props.repository, file.path),
        enabled,
      },
      {
        label: DefaultEditorLabel,
        action: () => this.props.dispatcher.openInExternalEditor(fullPath),
        enabled,
      },
      {
        label: OpenWithDefaultProgramLabel,
        action: () => openFile(fullPath, this.props.dispatcher),
        enabled: enabled && isSafeExtension,
      },
    ]

    return items
  }

  private onItemContextMenu = (
    row: number,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const file = this.getFilteredFiles()[row]
    if (!file) {
      return
    }

    const items = this.getContextMenuItems(file)
    showContextualMenu(items)
  }

  private renderRow = (row: number): JSX.Element => {
    const { availableWidth, workingDirectoryFiles } = this.props

    const filteredFiles = this.getFilteredFiles()
    const file = filteredFiles[row]

    if (!file) {
      return <div />
    }

    // Check if this file also exists in working directory
    const inWorkingDirectory = workingDirectoryFiles.some(
      wf => wf.path === file.path
    )

    const includedFileIds = new Set(this.state.includedFileIds)
    const include = includedFileIds.has(file.id)

    return (
      <StashedFileItem
        key={file.id}
        file={file}
        include={include}
        onIncludeChanged={this.onIncludeChanged}
        availableWidth={availableWidth}
        focused={this.state.focusedRow === row}
        inWorkingDirectory={inWorkingDirectory}
      />
    )
  }

  private renderHeader = (
    fileCount: number,
    filteredFileCount: number,
    allFiles: ReadonlyArray<CommittedFileChange>
  ): JSX.Element => {
    const filesPlural = fileCount === 1 ? 'file' : 'files'
    const visibleFilesLabel =
      filteredFileCount !== fileCount
        ? `${filteredFileCount} of ${fileCount} stashed ${filesPlural}`
        : `${fileCount} stashed ${filesPlural}`

    const includedFileIds = new Set(this.state.includedFileIds)
    const includedFileCount = allFiles.filter(f =>
      includedFileIds.has(f.id)
    ).length
    const selectedChangesDescription = `${includedFileCount}/${fileCount} stashed ${filesPlural} included`

    const totalCheckboxValue = this.getIncludeAllValue(
      allFiles,
      this.getFilteredFiles()
    )

    const filterState = {
      filterText: this.state.filterText,
      filterNewFiles: this.state.filterNewFiles,
      filterModifiedFiles: this.state.filterModifiedFiles,
      filterDeletedFiles: this.state.filterDeletedFiles,
    }

    return (
      <div className="header">
        <div className="filter-box-container">
          <span>
            <StashedFilesFilterOptions
              filterState={filterState}
              files={allFiles}
              onFilterNewFiles={this.onFilterNewFiles}
              onFilterModifiedFiles={this.onFilterModifiedFiles}
              onFilterDeletedFiles={this.onFilterDeletedFiles}
              onClearAllFilters={this.onClearAllFilters}
            />
          </span>
          <TextBox
            displayClearButton={true}
            placeholder="Filter"
            className="filter-list-filter-field"
            value={this.state.filterText}
            onValueChanged={this.onFilterTextChanged}
          />
        </div>
        <div className="checkbox-container">
          <Checkbox
            value={totalCheckboxValue}
            onChange={this.onToggleAllFiles}
            disabled={false}
            label={visibleFilesLabel}
            ariaDescribedBy="stashed-files-list-header"
            className="changes-list-check-all"
          />
        </div>
        <div className="sr-only" id="stashed-files-list-header">
          {selectedChangesDescription}
        </div>
      </div>
    )
  }

  private onToggleAllFiles = (event: React.FormEvent<HTMLInputElement>) => {
    const { stashEntry } = this.props

    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return
    }

    const includeAll = event.currentTarget.checked

    const filteredFiles = this.getFilteredFiles()
    const includedFileIds = new Set(this.state.includedFileIds)

    for (const file of filteredFiles) {
      if (includeAll) {
        includedFileIds.add(file.id)
      } else {
        includedFileIds.delete(file.id)
      }
    }

    this.setState({ includedFileIds: Array.from(includedFileIds) })
    this.props.onIncludedFilesChanged?.(Array.from(includedFileIds))

    for (const file of filteredFiles) {
      this.props.onIncludeChanged(file, includeAll)
    }
  }

  private getIncludeAllValue(
    allFiles: ReadonlyArray<CommittedFileChange>,
    filteredFiles: ReadonlyArray<CommittedFileChange>
  ): CheckboxValue {
    const includedFileIds = new Set(this.state.includedFileIds)
    const files =
      filteredFiles.length === allFiles.length ? allFiles : filteredFiles

    if (files.length === 0) {
      return CheckboxValue.Off
    }

    const includedCount = files.filter(f => includedFileIds.has(f.id)).length

    if (includedCount === 0) {
      return CheckboxValue.Off
    }

    if (includedCount === files.length) {
      return CheckboxValue.On
    }

    return CheckboxValue.Mixed
  }

  private getSelectedRowsFromProps(
    props: IStashedFilesListProps,
    filterState: Pick<
      IStashedFilesListState,
      | 'filterText'
      | 'filterNewFiles'
      | 'filterModifiedFiles'
      | 'filterDeletedFiles'
    >
  ): ReadonlyArray<number> {
    if (props.stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return []
    }

    const selectedRows: number[] = []
    const filteredFiles = this.getFilteredFilesFromState(props, filterState)

    for (const id of props.selectedFileIDs) {
      const ix = filteredFiles.findIndex(file => file.id === id)
      if (ix !== -1) {
        selectedRows.push(ix)
      }
    }

    return selectedRows
  }

  private getFilteredFilesFromState(
    props: IStashedFilesListProps,
    filterState: Pick<
      IStashedFilesListState,
      | 'filterText'
      | 'filterNewFiles'
      | 'filterModifiedFiles'
      | 'filterDeletedFiles'
    >
  ): ReadonlyArray<CommittedFileChange> {
    const { stashEntry } = props
    const {
      filterText,
      filterNewFiles,
      filterModifiedFiles,
      filterDeletedFiles,
    } = filterState

    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return []
    }

    let files = stashEntry.files.files

    if (filterText) {
      const lowerFilter = filterText.toLowerCase()
      files = files.filter(file =>
        file.path.toLowerCase().includes(lowerFilter)
      )
    }

    const hasStatusFilters =
      filterNewFiles || filterModifiedFiles || filterDeletedFiles
    if (hasStatusFilters) {
      files = files.filter(file => {
        const status = file.status.kind
        if (filterNewFiles && status === AppFileStatusKind.New) return true
        if (filterModifiedFiles && status === AppFileStatusKind.Modified)
          return true
        if (filterDeletedFiles && status === AppFileStatusKind.Deleted)
          return true
        return false
      })
    }

    return files
  }

  private getFilteredFiles = (): ReadonlyArray<CommittedFileChange> => {
    return this.getFilteredFilesFromState(this.props, this.state)
  }

  public render() {
    const { stashEntry } = this.props

    const allFiles =
      stashEntry.files.kind === StashedChangesLoadStates.Loaded
        ? stashEntry.files.files
        : []

    const totalFileCount = allFiles.length

    if (stashEntry.files.kind === StashedChangesLoadStates.NotLoaded) {
      return (
        <div className="changes-list-container file-list filtered-changes-list">
          {this.renderHeader(totalFileCount, 0, allFiles)}
          <div className="loading">Loading stash files...</div>
        </div>
      )
    }

    if (stashEntry.files.kind === StashedChangesLoadStates.Loading) {
      return (
        <div className="changes-list-container file-list filtered-changes-list">
          {this.renderHeader(totalFileCount, 0, allFiles)}
          <div className="loading">Loading...</div>
        </div>
      )
    }

    // TypeScript type guard - at this point we know files are loaded
    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return (
        <div className="changes-list-container file-list filtered-changes-list">
          {this.renderHeader(totalFileCount, 0, allFiles)}
        </div>
      )
    }

    const filteredFiles = this.getFilteredFiles()
    const filteredFileCount = filteredFiles.length

    return (
      <div className="changes-list-container file-list filtered-changes-list">
        {this.renderHeader(totalFileCount, filteredFileCount, allFiles)}
        <List
          rowCount={filteredFileCount}
          rowHeight={RowHeight}
          rowRenderer={this.renderRow}
          selectedRows={this.state.selectedRows}
          onSelectionChanged={this.onFileSelectionChanged}
          invalidationProps={{
            stashEntry,
            includedFileIds: this.state.includedFileIds,
            focusedRow: this.state.focusedRow,
            filterText: this.state.filterText,
            filterNewFiles: this.state.filterNewFiles,
            filterModifiedFiles: this.state.filterModifiedFiles,
            filterDeletedFiles: this.state.filterDeletedFiles,
          }}
          selectionMode="single"
          onRowKeyboardFocus={this.onRowFocus}
          onRowBlur={this.onRowBlur}
          onRowContextMenu={this.onItemContextMenu}
        />
      </div>
    )
  }
}
