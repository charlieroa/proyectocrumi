//Include Both Helper File with needed methods
import { getFirebaseBackend } from "../../../helpers/firebase_helper";
import { postFakeProfile, postJwtProfile } from "../../../helpers/fakebackend_helper";

// action
import { profileSuccess, profileError, resetProfileFlagChange } from "./reducer";

import { env } from "../../../env";

const fireBaseBackend : any = getFirebaseBackend();

export const editProfile = (user : any) => async (dispatch : any) => {
    try {
        let response;

        if (env.DEFAULTAUTH === "firebase") {
            response = fireBaseBackend.editProfileAPI(
                user.username,
                user.idx
            );

        } else if (env.DEFAULTAUTH === "jwt") {

            response = postJwtProfile(
                {
                    username: user.username,
                    idx: user.idx,
                }
            );

        } else if (env.DEFAULTAUTH === "fake") {
            response = postFakeProfile(user);
        }

        const data = await response;

        if (data) {
            dispatch(profileSuccess(data));
        }

    } catch (error) {
        dispatch(profileError(error));
    }
};

export const resetProfileFlag = () => {
    try {
        const response = resetProfileFlagChange();
        return response;
    } catch (error) {
        return error;
    }
};