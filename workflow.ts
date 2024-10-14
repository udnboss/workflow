//define app roles
// const ROLES = {
//     "user": { id: "user", name: "UserDTO" }, //user role members can create sow draft and submit them
//     "initiator": { id: "initiator", name: "Initiator" }, //special role - auto assigned if current user is the initiator of the current sow workflow
//     "reviewer": { id: "reviewer", name: "Reviewer" },
//     "distributor": { id: "distributor", name: "Distributor" },
//     "representative": { id: "representative", name: "Representative" },
//     "approver": { id: "approver", name: "Approver" }
// };

type RoleId = 'user' | 'initiator' | 'reviewer' | 'distributor' | 'representative' | 'approver';
type StateId = 'draft' | 'pending_initial_review' | 'pending_distributor_review' | 'pending_representative_review' | 'pending_approval' | 'approved' | 'rejected';
type StageId = 'draft' | 'in_progress' | 'approved' | 'rejected';

type Role = {
    id: RoleId;
    title: string;
}

type UserDTO = {
    id: string;
    name: string;
    roleIds: RoleId[];
}
type Stage = {
    id: StageId;
    title: string;
}

type State = {
    id: StateId;
    title: string;
    stageId: StageId;
    actions?: Action[];
}

type Action = {
    id: string;
    title: string;
    targetStateId: StateId;
    roleIds: RoleId[];
}

type WorkflowEvent<T> = {
    id: string;
    timestamp: Date;
    prevStateId: StateId;
    actionId: string;
    newStateId: StateId;
    performedBy: string;
    remarks: string | null;
    payload: T;
}

type WorkflowDefinition = {
    roles: Record<RoleId, Role>;
    stages: Record<StageId, Stage>;
    states: Record<StateId, State>;
    initialStateId: StateId;
    finalStateId: StateId;
}

//sample users with roleIds assigned
const USERS: Record<string, UserDTO> = {
    "sow_user": { id: "sow_user", name: "UserDTO", roleIds: ["user"] },
    "reviewer_user": { id: "reviewer_user", name: "Reviewer UserDTO", roleIds: ["reviewer"] },
    "distributor_user": { id: "distributor_user", name: "Distributor UserDTO", roleIds: ["distributor"] },
    "representative_user": { id: "representative_user", name: "Representative UserDTO", roleIds: ["representative"] },
    "approver_user": { id: "approver_user", name: "Approver UserDTO", roleIds: ["approver"] }
};

//sows collection to represent db collection
const SOWS: Sow[] = [];

//events collection to represent db collection
const EVENTS: WorkflowEvent<Sow>[] = [];


/**
 * The definition of the review and approval workflow process.
 */
const WORKFLOW_DEFINITION: WorkflowDefinition = {
    roles: {
        user: { id: "user", title: "UserDTO" },
        initiator: { id: "initiator", title: "Initiator" },
        reviewer: { id: "reviewer", title: "Reviewer" },
        distributor: { id: "distributor", title: "Distributor" },
        representative: { id: "representative", title: "Representative" },
        approver: { id: "approver", title: "Approver" }        
    },
    stages: {
        draft: { id: "draft", title: "Draft" },
        in_progress: { id: "in_progress", title: "In Progress" },
        approved: { id: "approved", title: "Approved" },
        rejected: { id: "rejected", title: "Rejected" }
    },
    states: {
        draft: {
            id: "draft",
            title: "Draft",
            stageId: "draft",
            actions: [
                {
                    id: "submit",
                    title: "Submit",
                    targetStateId: "pending_initial_review",
                    roleIds: ["initiator"]
                }
            ]
        },
        pending_initial_review: {
            id: "pending_initial_review",
            title: "Pending Initial Review",
            stageId: "in_progress",
            actions: [
                {
                    id: "approve",
                    title: "Approve",
                    targetStateId: "pending_distributor_review",
                    roleIds: ["reviewer"]
                },
                {
                    id: "reject",
                    title: "Reject",
                    targetStateId: "rejected",
                    roleIds: ["reviewer"]
                }
            ]
        },
        pending_distributor_review: {
            id: "pending_distributor_review",
            title: "Pending Distributor Review",
            stageId: "in_progress",
            actions: [
                {
                    id: "approve",
                    title: "Approve",
                    targetStateId: "pending_representative_review",
                    roleIds: ["distributor"]
                },
                {
                    id: "reject",
                    title: "Reject",
                    targetStateId: "rejected",
                    roleIds: ["distributor"]
                }
            ]
        },
        pending_representative_review: {
            id: "pending_representative_review",
            title: "Pending Representative Review",
            stageId: "in_progress",
            actions: [
                {
                    id: "approve",
                    title: "Approve",
                    targetStateId: "pending_approval",
                    roleIds: ["representative"]
                },
                {
                    id: "reject",
                    title: "Reject",
                    targetStateId: "rejected",
                    roleIds: ["representative"]
                }
            ]
        },
        pending_approval: {
            id: "pending_approval",
            title: "Pending Approval",
            stageId: "in_progress",
            actions: [
                {
                    id: "approve",
                    title: "Approve",
                    targetStateId: "approved",
                    roleIds: ["approver"]
                },
                {
                    id: "reject",
                    title: "Reject",
                    targetStateId: "rejected",
                    roleIds: ["approver"]
                }
            ]
        },
        approved: {
            id: "approved",
            title: "Approved",
            stageId: "approved"
        },
        rejected: {
            id: "rejected",
            title: "Rejected",
            stageId: "rejected",
            actions: [
                {
                    id: "edit",
                    title: "Edit",
                    targetStateId: "draft",
                    roleIds: ["initiator"]
                }
            ]
        }
    },
    initialStateId: "draft",
    finalStateId: "approved"
};

interface IWorkflowPayload {
    id: string;
    stateId: StateId;
}

class Workflow<T extends IWorkflowPayload> {
    private _initiatedBy: UserDTO;
    private _currentUserDTO!: UserDTO;
    private _currentState!: State;
    private _userRoleIds: RoleId[] = [];
    private _workflowDefinition!: WorkflowDefinition;
    private _payload!: T;

    constructor(initiatedBy: UserDTO, 
        currentUserDTO: UserDTO, 
        workflowDefinition:WorkflowDefinition, 
        currentStateId:StateId, 
        public payload: T) {
            this._initiatedBy = initiatedBy;
            this.currentUser = currentUserDTO;
            this._workflowDefinition = workflowDefinition;
            this._currentState = this.getStateById(currentStateId || this._workflowDefinition.initialStateId);
    }

    get createdBy():UserDTO {
        return this._initiatedBy;
    }

    get currentState(): State {
        return this._currentState;
    }

    set currentUser(user: UserDTO) {
        this._currentUserDTO = user;
        this.setRoleIds();
    }
    get currentUser(): UserDTO {
        return this._currentUserDTO;
    }

    get workflowDefinition() {
        return this._workflowDefinition;
    }

    private setRoleIds() {  
        this._userRoleIds = [...this._currentUserDTO.roleIds];
        //current user is the creator
        if (this._initiatedBy.id === this._currentUserDTO.id) {
            this._userRoleIds.push("initiator");
        }
    }

    private getStateById(stateId: StateId) {
        const state = this._workflowDefinition.states[stateId];
        if (!state) {
            throw new Error(`State ${stateId} not found`);
        }
        return state;
    }

    private getAction(actionId: string) {
        const action = this._currentState?.actions?.find(action => action.id === actionId);
        if (!action) {
            throw new Error(`Action ${actionId} not found`);
        }
        return action;
    }

    public getPossibleActions(): Action[] {
        return this._currentState?.actions?.filter(action => action.roleIds.some(roleId => this._userRoleIds.includes(roleId))) || [];
    }

    public performAction(actionId: string, remarks: string|undefined|null):WorkflowEvent<T> {

        const action = this.getAction(actionId);

        const possibleActions = this.getPossibleActions();
        if (!possibleActions.includes(action)) {
            throw new Error(`UserDTO ${this._currentUserDTO.id} is not allowed to perform action ${actionId}`);
        }

        const workflowEvent = {
            id: Math.random()+"",
            payloadId: this._payload.id,
            timestamp: new Date(),
            prevStateId: this.currentState.id,
            actionId,
            newStateId: action.targetStateId,
            performedBy: this._currentUserDTO.id,
            remarks: remarks || null,
            payload: this._payload
        };
        
        this._currentState = this.getStateById(action.targetStateId);

        this._payload.stateId = action.targetStateId;

        return workflowEvent;

    }
}

type SowDTO = {
    id: string;
    title: string;
    createdBy: UserDTO;
    stateId: StateId;
}

class Sow implements IWorkflowPayload {
    id: string;
    title: string;
    createdBy: UserDTO;
    stateId: StateId;
    constructor(public sow:SowDTO) {
        this.id = sow.id;
        this.title = sow.title;
        this.createdBy = sow.createdBy;
        this.stateId = sow.stateId;
    }
}

class WorkflowRequest<T extends IWorkflowPayload> {
    id: string;
    workflow: Workflow<T>;
    constructor(id:string, initiatedBy:UserDTO, currentUser:UserDTO, workflowDefinition:WorkflowDefinition, currentStateId:StateId, payload: T) {
        this.id = id;
        this.workflow = new Workflow<T>(initiatedBy, currentUser, workflowDefinition, currentStateId, payload);
    }
}






//test
//sow id for testing
const [sowId, sowTitle, creator] = ["sample_sow", "Sample SOW", USERS.sow_user];
const sowDto:SowDTO = { id: sowId, title: sowTitle, createdBy: creator, stateId: "draft" };
//perform some workflow actions by different users at different states
const tests = [
    { user: USERS.sow_user, actionId: "submit", remarks: "kindly review this" },
    { user: USERS.reviewer_user, actionId: "approve", remarks: "looks ok" },
    { user: USERS.distributor_user, actionId: "approve", remarks: "-" },
    { user: USERS.representative_user, actionId: "approve", remarks: "fine" },
    { user: USERS.approver_user, actionId: "reject", remarks: "not acceptable details"  },
    { user: USERS.sow_user, actionId: "edit" },
];

let lastStateId: StateId = "draft";

for (const test of tests) {
    console.log(`Switching to user: ${test.user.name}, last state: ${lastStateId}`);
    const sow = new Sow(sowDto);
    const req = new WorkflowRequest<Sow>("req-1", creator, test.user, WORKFLOW_DEFINITION, lastStateId, sow);
    console.log(`   Current state is: ${req.workflow.currentState.title}`);
    console.log(`   Possible user actions are: ${req.workflow.getPossibleActions().map(a => a.id).join(", ")}`);
    console.log(`   Performing actionId: ${test.actionId}`);
    const workflowEvent = req.workflow.performAction(test.actionId, test.remarks);
    console.log(`   New state is: ${req.workflow.currentState.title}`);
    lastStateId = sow.stateId; //update last state
    
    EVENTS.push(workflowEvent);
};

console.log(EVENTS);
