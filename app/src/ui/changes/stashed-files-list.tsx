import * as React from 'react'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { IStashEntry, StashedChangesLoadStates } from '../../models/stash-entry'
import { CommittedFileChange, WorkingDirectoryFileChange, AppFileStatusKind } from '../../models/status'
import { List } from '../lib/list'
import { StashedFileItem } from './stashed-file-item'
import { Checkbox, CheckboxValue } from '../lib/checkbox'
import { TextBox } from '../lib/text-box'
import { StashedFilesFilterOptions } from './stashed-files-filter-options'

const RowHeight = 29

interface IStashedFilesListProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly stashEntry: IStashEntry
  readonly selectedFileIDs: ReadonlyArray<string>
  readonly onFileSelectionChanged: (file: CommittedFileChange) => void
  readonly onIncludeChanged: (file: CommittedFileChange, include: boolean) => void
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
}

export class StashedFilesList extends React.Component<
  IStashedFilesListProps,
  IStashedFilesListState
> {
  public constructor(props: IStashedFilesListProps) {
    super(props)

    this.state = {
      selectedRows: [],
      focusedRow: null,
      filterText: '',
      filterNewFiles: false,
      filterModifiedFiles: false,
      filterDeletedFiles: false,
    }
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
      const file = stashEntry.files.files[rows[0]]
      this.props.onFileSelectionChanged(file)
    }
  }

  private onIncludeChanged = (file: CommittedFileChange, include: boolean) => {
    this.props.onIncludeChanged(file, include)
  }

  private onFileClick = (file: CommittedFileChange) => {
    this.props.onFileSelectionChanged(file)
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

    // For stashed files, we use a simple included/excluded state
    // All files are initially "included" for restore operation
    const include = true

    return (
      <StashedFileItem
        key={file.id}
        file={file}
        include={include}
        onIncludeChanged={this.onIncludeChanged}
        onClick={this.onFileClick}
        availableWidth={availableWidth}
        focused={this.state.focusedRow === row}
        inWorkingDirectory={inWorkingDirectory}
      />
    )
  }

  private renderHeader = (fileCount: number, filteredFileCount: number, allFiles: ReadonlyArray<CommittedFileChange>): JSX.Element => {
    const filesPlural = fileCount === 1 ? 'file' : 'files'
    const hasFilters = this.state.filterText.length > 0 ||
      this.state.filterNewFiles ||
      this.state.filterModifiedFiles ||
      this.state.filterDeletedFiles

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
            value={CheckboxValue.On}
            onChange={() => {}}
            disabled={false}
            label={
              hasFilters
                ? `${filteredFileCount} of ${fileCount} stashed ${filesPlural}`
                : `${fileCount} stashed ${filesPlural}`
            }
            ariaDescribedBy="stashed-files-list-header"
            className="changes-list-check-all"
          />
        </div>
      </div>
    )
  }

  private getFilteredFiles = (): ReadonlyArray<CommittedFileChange> => {
    const { stashEntry } = this.props
    const { filterText, filterNewFiles, filterModifiedFiles, filterDeletedFiles } = this.state

    if (stashEntry.files.kind !== StashedChangesLoadStates.Loaded) {
      return []
    }

    let files = stashEntry.files.files

    // Apply text filter
    if (filterText) {
      const lowerFilter = filterText.toLowerCase()
      files = files.filter(file =>
        file.path.toLowerCase().includes(lowerFilter)
      )
    }

    // Apply status filters
    const hasStatusFilters = filterNewFiles || filterModifiedFiles || filterDeletedFiles
    if (hasStatusFilters) {
      files = files.filter(file => {
        const status = file.status.kind
        if (filterNewFiles && status === AppFileStatusKind.New) return true
        if (filterModifiedFiles && status === AppFileStatusKind.Modified) return true
        if (filterDeletedFiles && status === AppFileStatusKind.Deleted) return true
        return false
      })
    }

    return files
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
      return <div className="changes-list-container file-list filtered-changes-list">{this.renderHeader(totalFileCount, 0, allFiles)}</div>
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
          invalidationProps={stashEntry}
          selectionMode="single"
        />
      </div>
    )
  }
}
