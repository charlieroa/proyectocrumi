import { userForgetPasswordSuccess, userForgetPasswordError } from "./reducer"

//Include Both Helper File with needed methods
import { getFirebaseBackend } from "../../../helpers/firebase_helper";

import {
  postFakeForgetPwd,
  postJwtForgetPwd,
} from "../../../helpers/fakebackend_helper";

import { env } from "../../../env";

const fireBaseBackend : any = getFirebaseBackend();

export const userForgetPassword = (user : any, history : any) => async (dispatch : any) => {
  try {
      let response;
      if (env.DEFAULTAUTH === "firebase") {

          response = fireBaseBackend.forgetPassword(
              user.email
          )

      } else if (env.DEFAULTAUTH === "jwt") {
          response = postJwtForgetPwd(
              user.email
          )
      } else {
          response = postFakeForgetPwd(
              user.email
          )
      }

      const data = await response;

      if (data) {
          dispatch(userForgetPasswordSuccess(
              "Reset link are sended to your mailbox, check there first"
          ))
      }
  } catch (forgetError) {
      dispatch(userForgetPasswordError(forgetError))
  }
}