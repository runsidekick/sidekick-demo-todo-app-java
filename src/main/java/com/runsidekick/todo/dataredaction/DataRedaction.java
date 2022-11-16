package com.runsidekick.todo.dataredaction;

import com.runsidekick.agent.api.dataredaction.DataRedactionContext;
import com.runsidekick.agent.api.dataredaction.SidekickDataRedactionAPI;

/**
 * @author yasin.kalafat
 */
public class DataRedaction implements SidekickDataRedactionAPI {

    @Override
    public String redactLogMessage(DataRedactionContext dataRedactionContext, String logExpression, String logMessage) {
        return SidekickDataRedactionAPI.super.redactLogMessage(dataRedactionContext, logExpression, logMessage);
    }

    @Override
    public boolean shouldRedactVariable(DataRedactionContext dataRedactionContext, String s) {
        return false;
    }
}
