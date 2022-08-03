FROM openjdk:8
RUN mkdir -p /app
COPY target/sidekick-demo-todo-app-java.jar /app/sidekick-demo-todo-app-java.jar
COPY sidekick-agent-bootstrap.jar /app/sidekick-agent-bootstrap.jar
WORKDIR /app
EXPOSE 8080
ENV SIDEKICK_AGENT_APPLICATION_NAME=sidekick-demo-todo-app-java
ENV SIDEKICK_AGENT_APPLICATION_TAG_SIDEKICK_DEBUGGER_ONBOARDING=true
ENV SIDEKICK_AGENT_APPLICATION_VERSION=1.0.0
ENV SIDEKICK_AGENT_APPLICATION_STAGE=onboarding
ENTRYPOINT [ "java", "-javaagent:sidekick-agent-bootstrap.jar", "-jar", "sidekick-demo-todo-app-java.jar" ]
